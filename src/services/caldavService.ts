import { createDAVClient, DAVClient, DAVCalendarObject, DAVNamespaceShort } from 'tsdav';
import { useAppStore } from '../stores/useAppStore';
import { parseISO } from 'date-fns';

const getClient = async (): Promise<DAVClient> => {
  let { serverUrl, username, password } = useAppStore.getState().caldavSettings;
  
  // Sanitize URL
  serverUrl = serverUrl.trim();
  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
    serverUrl = 'https://' + serverUrl;
  }
  
  // Special fix for QQ Mail (dav.qq.com) which requires full path: https://dav.qq.com/dav/USERNAME/
  if (serverUrl.includes('dav.qq.com') && !serverUrl.includes('/dav/')) {
     const userPart = username.includes('@') ? username.split('@')[0] : username;
     // QQ CalDAV usually works with https://dav.qq.com/dav/YOUR_QQ_NUMBER/
     // Let's try appending the detected username part.
     serverUrl = `https://dav.qq.com/dav/${userPart}/`;
     console.log('Auto-corrected QQ CalDAV URL to:', serverUrl);
  }

  // Remove trailing slash if present, though usually handled by lib
  // Ensure valid URL
  try {
    new URL(serverUrl);
  } catch (e) {
    throw new Error(`服务器地址格式无效: "${serverUrl}"。请确保包含 https://`);
  }

  return await createDAVClient({
    serverUrl,
    credentials: {
      username: username.trim(),
      password: password.trim(),
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
};

export const checkConnection = async () => {
  try {
    console.log('Attempting to connect with:', useAppStore.getState().caldavSettings.serverUrl);
    const client = await getClient();
    const calendars = await client.fetchCalendars();
    console.log('Calendars found:', calendars);
    return calendars.length > 0;
  } catch (e: any) {
    console.error('CalDAV Connection Error', e);
    // Log more details if available
    if (e.response) {
        console.error('Response status:', e.response.status);
        console.error('Response text:', e.response.statusText);
    }
    throw new Error('连接失败，请检查服务器地址和账号密码。详细错误请查看控制台 (F12)');
  }
};

export const syncTasks = async () => {
  const client = await getClient();
  
  // 1. Fetch Calendars
  const calendars = await client.fetchCalendars();
  console.log('Found calendars:', calendars.map(c => ({ name: c.displayName, url: c.url, writable: c.permissions?.canWrite, components: c.components })));
  
  if (calendars.length === 0) {
    throw new Error('未找到可用日历');
  }

  const writableCalendars = calendars.filter(c => c.permissions?.canWrite !== false);
  const veventCalendars = writableCalendars.filter(c => !c.components || c.components.includes('VEVENT'));
  // Use the first available writable VEVENT calendar, fallback to any writable calendar.
  const targetCalendar = veventCalendars[0] ?? writableCalendars[0] ?? calendars[0];
  console.log(`Syncing to calendar: ${targetCalendar.displayName || 'Default'} (${targetCalendar.url})`);

  const localTasks = useAppStore.getState().tasks;
  const timedTasks = localTasks.filter(task => task.hasTime && task.startTime);
  const timeRange = (() => {
    let minTime = Number.POSITIVE_INFINITY;
    let maxTime = Number.NEGATIVE_INFINITY;
    for (const task of timedTasks) {
      const start = parseISO(task.startTime!).getTime();
      if (Number.isNaN(start)) continue;
      const end = task.endTime ? parseISO(task.endTime).getTime() : start + 3600000;
      if (Number.isNaN(end)) continue;
      if (start < minTime) minTime = start;
      if (end > maxTime) maxTime = end;
    }
    if (!Number.isFinite(minTime) || !Number.isFinite(maxTime)) return null;
    const padMs = 24 * 60 * 60 * 1000;
    return {
      start: new Date(minTime - padMs).toISOString(),
      end: new Date(maxTime + padMs).toISOString(),
    };
  })();

  // 2. Fetch Remote Events
  let remoteObjects = timeRange
    ? await client.fetchCalendarObjects({
        calendar: targetCalendar,
        useMultiGet: false,
        timeRange,
      })
    : await client.fetchCalendarObjects({
        calendar: targetCalendar,
        useMultiGet: false,
      });
  if (timeRange && remoteObjects.length === 0) {
    const fallbackObjects = await client.fetchCalendarObjects({
      calendar: targetCalendar,
      useMultiGet: false,
    });
    if (fallbackObjects.length > 0) {
      remoteObjects = fallbackObjects;
    }
  }
  let remoteByUid = new Map<string, DAVCalendarObject>();
  let remoteByFilename = new Map<string, DAVCalendarObject>();
  const normalizeEtag = (etag?: string) => {
    if (!etag || etag === 'undefined' || etag === 'null') return undefined;
    return etag;
  };
  const veventFilters = [
    {
      'comp-filter': {
        _attributes: { name: 'VCALENDAR' },
        'comp-filter': {
          _attributes: { name: 'VEVENT' },
        },
      },
    },
  ];
  const extractUid = (ical?: string) => {
    if (!ical) return null;
    const unfolded = ical.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    for (const line of lines) {
      if (!line.toUpperCase().startsWith('UID')) continue;
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) continue;
      return line.slice(separatorIndex + 1).trim();
    }
    return null;
  };
  const extractFilename = (url: string) => {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('/');
      return parts[parts.length - 1] || null;
    } catch {
      const parts = url.split('/');
      return parts[parts.length - 1] || null;
    }
  };
  const lookupRemoteObjectByUid = async (uid: string): Promise<DAVCalendarObject | null> => {
    try {
      const results = await client.calendarQuery({
        url: targetCalendar.url,
        props: {
          [`${DAVNamespaceShort.DAV}:getetag`]: {},
          [`${DAVNamespaceShort.CALDAV}:calendar-data`]: {},
        },
        filters: [
          {
            'comp-filter': {
              _attributes: { name: 'VCALENDAR' },
              'comp-filter': {
                _attributes: { name: 'VEVENT' },
                'prop-filter': {
                  _attributes: { name: 'UID' },
                  'text-match': {
                    _attributes: { collation: 'i;octet' },
                    _text: uid,
                  },
                },
              },
            },
          },
        ],
        depth: '1',
      });
      const match = results.find(
        (res) => res.ok && typeof res.href === 'string' && res.href.includes('.ics')
      );
      if (!match?.href) return null;
      const data =
        match.props?.calendarData?._cdata ?? match.props?.calendarData;
      const etag = normalizeEtag(
        typeof match.props?.getetag === 'string'
          ? match.props.getetag
          : match.props?.getetag
          ? `${match.props.getetag}`
          : undefined
      );
      return {
        url: new URL(match.href, targetCalendar.url).href,
        etag,
        data,
      };
    } catch (error) {
      console.error('Failed to query remote event by UID', uid, error);
      return null;
    }
  };
  const loadAllObjectsWithData = async (): Promise<DAVCalendarObject[]> => {
    try {
      const results = await client.calendarQuery({
        url: targetCalendar.url,
        props: {
          [`${DAVNamespaceShort.DAV}:getetag`]: {},
          [`${DAVNamespaceShort.CALDAV}:calendar-data`]: {},
        },
        filters: veventFilters,
        depth: '1',
      });
      return results
        .filter((res) => res.ok && typeof res.href === 'string')
        .map((res) => ({
          url: new URL(res.href as string, targetCalendar.url).href,
          etag: normalizeEtag(
            typeof res.props?.getetag === 'string'
              ? res.props.getetag
              : res.props?.getetag
              ? `${res.props.getetag}`
              : undefined
          ),
          data: res.props?.calendarData?._cdata ?? res.props?.calendarData,
        }));
    } catch (error) {
      console.error('Failed to fetch full calendar data', error);
      return [];
    }
  };
  const readResponseBody = async (response: Response) => {
    try {
      return await response.clone().text();
    } catch (error) {
      console.error('Failed to read CalDAV response body', error);
      return '';
    }
  };
  const extractConflictHref = (body: string) => {
    if (!body) return null;
    const regex = /<(?:[^>]*:)?href>([^<]+)<\/(?:[^>]*:)?href>/gi;
    const matches = Array.from(body.matchAll(regex))
      .map(match => match[1]?.trim())
      .filter(Boolean);
    if (matches.length === 0) return null;
    return matches.find(href => href.includes('.ics')) ?? matches[0];
  };
  const extractConflictHrefFromHeaders = (response: Response) => {
    const location =
      response.headers.get('location') ||
      response.headers.get('Location') ||
      response.headers.get('content-location') ||
      response.headers.get('Content-Location');
    return location ? location.trim() : null;
  };
  const toAbsoluteUrl = (href: string) => {
    if (!href) return href;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }
    return new URL(href, targetCalendar.url).href;
  };
  const logResponseError = async (response: Response, context: string, bodyOverride?: string) => {
    const body = bodyOverride ?? (await readResponseBody(response));
    const headers = Object.fromEntries(response.headers.entries());
    console.error(context, response.status, response.statusText, headers, body);
  };
  const fetchObjectEtag = async (url: string) => {
    try {
      const results = await client.propfind({
        url,
        props: {
          [`${DAVNamespaceShort.DAV}:getetag`]: {},
        },
        depth: '0',
      });
      const match = results.find((res) => res.ok && res.href);
      if (!match) {
        console.warn('PROPFIND ETag failed', {
          url,
          statuses: results.map((res) => ({
            status: res.status,
            statusText: res.statusText,
            href: res.href,
          })),
        });
      }
      const rawEtag =
        typeof match?.props?.getetag === 'string'
          ? match?.props?.getetag
          : match?.props?.getetag
          ? `${match?.props?.getetag}`
          : undefined;
      return normalizeEtag(rawEtag);
    } catch (error) {
      console.error('Failed to fetch ETag for object', url, error);
      return undefined;
    }
  };
  const updateByUrl = async (url: string, data: string, etag?: string) => {
    const response = await client.updateCalendarObject({
      calendarObject: {
        url,
        data,
        etag,
      },
    });
    return response;
  };
  const indexRemoteObjects = (objects: DAVCalendarObject[]) => {
    const byUid = new Map<string, DAVCalendarObject>();
    const byFilename = new Map<string, DAVCalendarObject>();
    let objectsWithData = 0;
    for (const obj of objects) {
      const normalizedObject: DAVCalendarObject = {
        ...obj,
        etag: normalizeEtag(obj.etag),
      };
      if (normalizedObject.url) {
        const filename = extractFilename(normalizedObject.url);
        if (filename) {
          byFilename.set(filename, normalizedObject);
        }
      }
      if (typeof normalizedObject.data === 'string') {
        objectsWithData += 1;
        const uid = extractUid(normalizedObject.data);
        if (uid) {
          byUid.set(uid, normalizedObject);
        }
      }
    }
    return { byUid, byFilename, objectsWithData };
  };

  let indexed = indexRemoteObjects(remoteObjects);
  if (indexed.byUid.size === 0 && remoteObjects.length > 0) {
    const fullObjects = await loadAllObjectsWithData();
    if (fullObjects.length > 0) {
      indexed = indexRemoteObjects(fullObjects);
    }
  }
  remoteByUid = indexed.byUid;
  remoteByFilename = indexed.byFilename;
  console.log('Remote objects indexed:', {
    total: remoteObjects.length,
    withData: indexed.objectsWithData,
    uidCount: remoteByUid.size,
  });
  
  // 3. Push Local Tasks to Remote (Simple Logic: Create if not exists)
  const escapeICalText = (value: string) =>
    value
      .replace(/\\/g, '\\\\')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  const formatUtc = (date: Date) =>
    date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  for (const task of localTasks) {
    if (!task.hasTime) continue; 
    
    const event = {
      start: parseISO(task.startTime!).getTime(),
      end: task.endTime ? parseISO(task.endTime).getTime() : parseISO(task.startTime!).getTime() + 3600000,
      summary: task.title,
      uid: task.id, 
      description: task.description || '',
    };
    
    // Use UTC time to satisfy servers that reject floating local time.
    const startStr = formatUtc(new Date(event.start));
    const endStr = formatUtc(new Date(event.end));
    const nowStr = formatUtc(new Date());

    const CRLF = '\r\n';
    const iCalString = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'PRODID:-//DailyPlanner//CN',
      'BEGIN:VEVENT',
      `UID:${task.id}`,
      `DTSTAMP:${nowStr}`,
      `DTSTART:${startStr}`, 
      `DTEND:${endStr}`,
      `SUMMARY:${escapeICalText(task.title)}`,
      `DESCRIPTION:${escapeICalText(task.description || '')}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join(CRLF);

    const filename = `${task.id}.ics`;
    const objectUrl = new URL(filename, targetCalendar.url).href;
    const existingObject =
      remoteByFilename.get(filename) || remoteByUid.get(task.id);

    try {
      if (existingObject?.url) {
        const updateResponse = await client.updateCalendarObject({
          calendarObject: {
            ...existingObject,
            data: iCalString,
            etag: normalizeEtag(existingObject.etag),
          },
        });
        if (updateResponse.ok) {
          console.log(`Updated event for task: ${task.title}`);
          continue;
        }
        let updateBody: string | undefined;
        if (updateResponse.status === 409 || updateResponse.status === 412) {
          updateBody = await readResponseBody(updateResponse);
          if (updateResponse.status === 409) {
            const conflictHref =
              extractConflictHrefFromHeaders(updateResponse) ||
              extractConflictHref(updateBody);
            if (conflictHref) {
              const conflictUrl = toAbsoluteUrl(conflictHref);
              const conflictEtag = await fetchObjectEtag(conflictUrl);
              const conflictResponse = await updateByUrl(
                conflictUrl,
                iCalString,
                conflictEtag ?? '*'
              );
              if (conflictResponse.ok) {
                console.log(`Updated event for task: ${task.title}`);
                continue;
              }
              await logResponseError(
                conflictResponse,
                `Failed to update conflicted task: ${task.title}`
              );
              continue;
            }
          }
          const refreshEtag = await fetchObjectEtag(existingObject.url);
          if (refreshEtag) {
            const refreshResponse = await updateByUrl(
              existingObject.url,
              iCalString,
              refreshEtag
            );
            if (refreshResponse.ok) {
              console.log(`Updated event with refreshed ETag: ${task.title}`);
              continue;
            }
            await logResponseError(
              refreshResponse,
              `Failed to update with refreshed ETag: ${task.title}`
            );
          }
          if (updateBody) {
            console.warn(`Update 409 body for task: ${task.title}`, updateBody);
          }
          const looseUpdateResponse = await updateByUrl(existingObject.url, iCalString);
          if (looseUpdateResponse.ok) {
            console.log(`Updated event without ETag: ${task.title}`);
            continue;
          }
          await logResponseError(
            looseUpdateResponse,
            `Failed to update without ETag: ${task.title}`
          );
          const refreshedObject = await lookupRemoteObjectByUid(task.id);
          if (refreshedObject) {
            const retryResponse = await client.updateCalendarObject({
              calendarObject: {
                ...refreshedObject,
                data: iCalString,
                etag: normalizeEtag(refreshedObject.etag),
              },
            });
            if (retryResponse.ok) {
              console.log(`Updated event for task: ${task.title}`);
              continue;
            }
            await logResponseError(
              retryResponse,
              `Failed to update task after refresh: ${task.title}`
            );
            continue;
          }
        }
        await logResponseError(
          updateResponse,
          `Failed to update task: ${task.title}`,
          updateBody
        );
      } else {
        const createResponse = await client.createCalendarObject({
          calendar: targetCalendar,
          filename,
          iCalString,
        });
        if (createResponse.ok) {
          console.log(`Created event for task: ${task.title}`);
          continue;
        }
        let createBody: string | undefined;
        if (createResponse.status === 409) {
          createBody = await readResponseBody(createResponse);
          const conflictHref =
            extractConflictHrefFromHeaders(createResponse) ||
            extractConflictHref(createBody);
          if (conflictHref) {
            const conflictUrl = toAbsoluteUrl(conflictHref);
            const conflictEtag = await fetchObjectEtag(conflictUrl);
            const conflictResponse = await updateByUrl(
              conflictUrl,
              iCalString,
              conflictEtag ?? '*'
            );
            if (conflictResponse.ok) {
              console.log(`Updated event for task: ${task.title}`);
              continue;
            }
            await logResponseError(
              conflictResponse,
              `Failed to update existing object by URL: ${task.title}`
            );
          }
          const directEtag = await fetchObjectEtag(objectUrl);
          if (directEtag) {
            const directEtagResponse = await updateByUrl(
              objectUrl,
              iCalString,
              directEtag
            );
            if (directEtagResponse.ok) {
              console.log(`Updated event with direct ETag: ${task.title}`);
              continue;
            }
            await logResponseError(
              directEtagResponse,
              `Failed to update with direct ETag: ${task.title}`
            );
          }
          if (createBody) {
            console.warn(`Create 409 body for task: ${task.title}`, createBody);
          }
          const forceUpdateResponse = await updateByUrl(objectUrl, iCalString, '*');
          if (forceUpdateResponse.ok) {
            console.log(`Updated event with If-Match *: ${task.title}`);
            continue;
          }
          await logResponseError(
            forceUpdateResponse,
            `Failed to update with If-Match *: ${task.title}`
          );
          const looseUpdateResponse = await updateByUrl(objectUrl, iCalString);
          if (looseUpdateResponse.ok) {
            console.log(`Updated event without ETag: ${task.title}`);
            continue;
          }
          await logResponseError(
            looseUpdateResponse,
            `Failed to update without ETag: ${task.title}`
          );
          const conflictObject = await lookupRemoteObjectByUid(task.id);
          if (conflictObject) {
            const updateResponse = await client.updateCalendarObject({
              calendarObject: {
                ...conflictObject,
                data: iCalString,
                etag: normalizeEtag(conflictObject.etag),
              },
            });
            if (updateResponse.ok) {
              console.log(`Updated event for task: ${task.title}`);
              continue;
            }
            await logResponseError(
              updateResponse,
              `Failed to resolve conflict for task: ${task.title}`
            );
            continue;
          }
        }
        await logResponseError(
          createResponse,
          `Failed to create task: ${task.title}`,
          createBody
        );
      }
    } catch (e: any) {
      console.error('Failed to sync task', task.title, e);
    }
  }
  
  return true;
};
