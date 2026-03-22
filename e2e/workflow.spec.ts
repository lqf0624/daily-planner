import { expect, test, type Browser, type Page } from '@playwright/test';

const openFreshApp = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
};

const configureAI = async (page: Page) => {
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-ai-api-key').fill('test-api-key');
  await page.getByTestId('settings-ai-base-url').fill('https://example.com/v1');
  await page.getByTestId('settings-ai-model').fill('gpt-test-model');
  await page.getByRole('button', { name: /close/i }).first().click();
};

const openFloatingPair = async (browser: Browser) => {
  const context = await browser.newContext();
  const mainPage = await context.newPage();
  const floatingPage = await context.newPage();
  await openFreshApp(mainPage);
  await floatingPage.goto('/?view=floating');
  return { context, mainPage, floatingPage };
};

test('today workspace creates task, updates notes, and persists after reload', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('today-quick-add-input').fill('today-task-a');
  await page.getByTestId('today-quick-add-button').click();
  await page.getByTestId('today-task-notes').fill('note-a');
  await page.reload();

  await expect(page.getByText('today-task-a').first()).toBeVisible();
  await expect(page.getByTestId('today-task-notes')).toHaveValue('note-a');
});

test('weekly planning creates a goal and links an existing task', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('today-quick-add-input').fill('weekly-link-task');
  await page.getByTestId('today-quick-add-button').click();
  await page.getByTestId('nav-weekly-plan').click();
  await page.getByTestId('weekly-plan-goal-input').fill('weekly-goal-a');
  await page.getByTestId('weekly-plan-add-goal').click();

  await expect(page.locator('input').filter({ hasValue: 'weekly-goal-a' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'weekly-link-task', exact: true }).click();
  await expect(page.getByRole('button', { name: 'weekly-link-task', exact: true })).toHaveClass(/bg-primary/);
});

test('quarterly goals can be created and updated', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('nav-goals').click();
  await page.getByTestId('quarterly-goals-new').click();
  await page.getByTestId('quarterly-goal-title').fill('goal-a');
  await page.getByTestId('quarterly-goal-save').click();

  await expect(page.getByText('goal-a')).toBeVisible();
  await page.locator('input[type="range"]').first().fill('60');
  await expect(page.getByText('60%')).toBeVisible();
});

test('calendar creates task and supports search', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('nav-calendar').click();
  await page.getByTestId('calendar-new-task').click();
  await page.getByTestId('calendar-task-title').fill('calendar-task-a');
  await page.getByTestId('calendar-task-save').click();

  await page.getByTestId('calendar-search-input').fill('calendar-task-a');
  await expect(page.locator('.fc-event, .fc-list-event').filter({ hasText: 'calendar-task-a' }).first()).toBeVisible();
});

test('calendar supports day view and navigating to past periods', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('nav-calendar').click();
  await page.getByTestId('calendar-view-dayGridMonth').click();
  const currentMonthTitle = await page.getByTestId('calendar-title').textContent();
  await page.getByTestId('calendar-prev').click();
  await expect(page.getByTestId('calendar-title')).not.toHaveText(currentMonthTitle || '');

  await page.getByTestId('calendar-view-timeGridDay').click();
  await expect(page.getByTestId('calendar-title')).toContainText(String(new Date().getFullYear()));
  const currentDayTitle = await page.getByTestId('calendar-title').textContent();
  await page.getByTestId('calendar-prev').click();
  await expect(page.getByTestId('calendar-title')).not.toHaveText(currentDayTitle || '');

  await page.getByTestId('calendar-today').click();
  await expect(page.getByTestId('calendar-title')).toContainText(String(new Date().getFullYear()));
});

test('pomodoro can bind current task from todo list', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('today-quick-add-input').fill('pomodoro-bind-task');
  await page.getByTestId('today-quick-add-button').click();
  await page.getByTestId('nav-pomodoro').click();
  await page.getByTestId('pomodoro-task-select').selectOption({ label: 'pomodoro-bind-task' });

  await expect(page.locator('div').filter({ hasText: 'pomodoro-bind-task' }).first()).toBeVisible();
});

test('today task can start focus and updates active focus card', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('today-quick-add-input').fill('focus-from-today');
  await page.getByTestId('today-quick-add-button').click();
  await page.getByTestId('today-bind-focus').click();

  await expect(page.getByTestId('pomodoro-task-select')).toHaveValue(/.+/);
  await page.getByTestId('nav-today').click();
  await expect(page.getByTestId('today-active-focus-count')).toHaveText('1');
});

test('today task detail can mark a task as completed', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('today-quick-add-input').fill('detail-complete-task');
  await page.getByTestId('today-quick-add-button').click();
  await page.getByTestId('today-detail-complete').click();

  await expect(page.getByTestId('today-detail-complete')).toContainText('Restore');
});

test('backlog task can be scheduled into today and then appears in calendar', async ({ page }) => {
  await openFreshApp(page);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const start = `${year}-${month}-${day}T14:00`;
  const end = `${year}-${month}-${day}T15:00`;

  await page.getByTestId('backlog-quick-add-input').fill('backlog-task-a');
  await page.getByTestId('backlog-quick-add-button').click();
  await page.getByTestId('today-detail-schedule').click();
  await page.getByTestId('backlog-schedule-start').fill(start);
  await page.getByTestId('backlog-schedule-end').fill(end);
  await page.getByTestId('backlog-schedule-save').click();

  await expect(page.getByText('backlog-task-a').first()).toBeVisible();
  await page.getByTestId('nav-calendar').click();
  await page.getByTestId('calendar-search-input').fill('backlog-task-a');
  await expect(page.locator('.fc-event, .fc-list-event').filter({ hasText: 'backlog-task-a' }).first()).toBeVisible();
});

test('calendar task dialog can mark a task as completed', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('nav-calendar').click();
  await page.getByTestId('calendar-new-task').click();
  await page.getByTestId('calendar-task-title').fill('calendar-complete-task');
  await page.getByTestId('calendar-task-status').selectOption('done');
  await page.getByTestId('calendar-task-save').click();

  await page.getByTestId('nav-today').click();
  await expect(page.getByText('calendar-complete-task').first()).toBeVisible();
});

test('ongoing task auto binds to current focus and pomodoro', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('today-quick-add-input').fill('auto-bind-task');
  await page.getByTestId('today-quick-add-button').click();
  await page.getByTestId('nav-pomodoro').click();

  await expect(page.getByTestId('pomodoro-task-select')).toHaveValue(/.+/);
  await expect(page.locator('div').filter({ hasText: 'auto-bind-task' }).first()).toBeVisible();
});

test('weekly report prepares template and accepts input', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('nav-weekly-report').click();
  await page.getByTestId('weekly-report-prepare').click();
  await page.getByTestId('weekly-report-summary').fill('weekly-summary-a');
  await page.getByTestId('weekly-report-save').click();

  await expect(page.getByTestId('weekly-report-summary')).toHaveValue('weekly-summary-a');
});

test('weekly report history can switch to an older saved report', async ({ page }) => {
  await openFreshApp(page);

  await page.evaluate(() => {
    const raw = localStorage.getItem('daily-planner-storage-v7');
    const persisted = raw ? JSON.parse(raw) : { state: {}, version: 7 };
    persisted.state.weeklyReports = [
      {
        id: 'report-current',
        weekNumber: 11,
        year: 2026,
        summary: 'report-current',
        wins: '',
        blockers: '',
        adjustments: '',
        createdAt: '2026-03-16T00:00:00.000Z',
        updatedAt: '2026-03-16T00:00:00.000Z',
      },
      {
        id: 'report-old',
        weekNumber: 10,
        year: 2026,
        summary: 'report-old',
        wins: 'older-win',
        blockers: '',
        adjustments: '',
        createdAt: '2026-03-09T00:00:00.000Z',
        updatedAt: '2026-03-09T00:00:00.000Z',
      },
    ];
    localStorage.setItem('daily-planner-storage-v7', JSON.stringify(persisted));
  });

  await page.reload();
  await page.getByTestId('nav-weekly-report').click();
  await page.getByTestId('weekly-report-quarter-2026-1').click();
  await page.getByTestId('weekly-report-history-2026-10').click();
  await expect(page.getByTestId('weekly-report-summary')).toHaveValue('report-old');
});

test('ai panel accepts input and can be toggled', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('ai-input').fill('plan my day');
  await expect(page.getByTestId('ai-input')).toHaveValue('plan my day');
  await page.getByTestId('toggle-ai-panel').click();
  await expect(page.getByTestId('ai-input')).toHaveCount(0);
  await page.getByTestId('toggle-ai-panel').click();
  await expect(page.getByTestId('ai-input')).toBeVisible();
});

test('settings updates ai configuration fields', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-ai-base-url').fill('https://example.com/v1');
  await page.getByTestId('settings-ai-model').fill('gpt-test-model');

  await expect(page.getByTestId('settings-ai-base-url')).toHaveValue('https://example.com/v1');
  await expect(page.getByTestId('settings-ai-model')).toHaveValue('gpt-test-model');
});

test('settings can switch app language manually', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-language-select').selectOption('de');
  await page.getByRole('button', { name: /schließen|close/i }).first().click();

  await expect(page.getByTestId('nav-today')).toContainText('Heute');
});

test('settings can check updates and render install action when a release is available', async ({ page }) => {
  await openFreshApp(page);

  await page.evaluate(() => {
    window.__TEST_UPDATER__ = {
      check: async () => ({
        currentVersion: '0.2.3',
        version: '0.2.4',
        body: 'bug fixes',
      }),
      downloadAndInstall: async () => undefined,
      relaunch: async () => undefined,
    };
  });

  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-check-update').click();

  await expect(page.getByTestId('settings-update-status')).toContainText('0.2.4');
  await expect(page.getByTestId('settings-install-update')).toBeVisible();
  await expect(page.getByTestId('settings-update-notes')).toContainText('bug fixes');
});

test('settings can create a new task category and calendar task can use it', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-list-name').fill('side-project');
  await page.getByTestId('settings-list-add').click();
  await expect(page.locator('input[value="side-project"]').first()).toBeVisible();
  await page.getByRole('button', { name: /close/i }).first().click();

  await page.getByTestId('nav-calendar').click();
  await page.getByTestId('calendar-new-task').click();
  await page.getByTestId('calendar-task-title').fill('side-project-task');
  await page.getByTestId('calendar-task-list-select').selectOption({ label: 'side-project' });
  await page.getByTestId('calendar-task-save').click();

  await page.getByTestId('calendar-search-input').fill('side-project-task');
  await expect(page.locator('.fc-event, .fc-list-event').filter({ hasText: 'side-project-task' }).first()).toBeVisible();
});

test('quarterly goals appear in weekly goal linking options', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('nav-goals').click();
  await page.getByTestId('quarterly-goals-new').click();
  await page.getByTestId('quarterly-goal-title').fill('goal-link-target');
  await page.getByTestId('quarterly-goal-save').click();
  await page.getByTestId('nav-weekly-plan').click();
  await page.getByTestId('weekly-plan-goal-input').fill('weekly-goal-link');
  await page.getByTestId('weekly-plan-add-goal').click();
  const quarterlySelect = page.locator('[data-testid^="weekly-goal-quarterly-select-"]').first();
  await quarterlySelect.selectOption({ label: 'goal-link-target' });

  await expect(quarterlySelect).not.toHaveValue('');
});

test('ai action preview can create a task and apply it into the calendar', async ({ page }) => {
  await openFreshApp(page);
  await configureAI(page);

  await page.route('https://example.com/v1/chat/completions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                content: 'drafted',
                actionPreview: {
                  type: 'create_task',
                  summary: 'create a prep task',
                  payload: {
                    title: 'ai-created-task',
                    date: '2026-03-19',
                    startTime: '09:00',
                    endTime: '10:00',
                    priority: 'high',
                    notes: 'ai notes',
                  },
                },
              }),
            },
          },
        ],
      }),
    });
  });

  await page.getByTestId('ai-input').fill('create task');
  await page.getByTestId('ai-input').press('Enter');
  await expect(page.getByText('create a prep task')).toBeVisible();
  await page.getByTestId('ai-apply-preview').click();

  await page.getByTestId('nav-calendar').click();
  await page.getByTestId('calendar-search-input').fill('ai-created-task');
  await expect(page.locator('.fc-event, .fc-list-event').filter({ hasText: 'ai-created-task' }).first()).toBeVisible();
});

test('ai action preview can draft weekly report and apply the generated content', async ({ page }) => {
  await openFreshApp(page);
  await configureAI(page);

  await page.route('https://example.com/v1/chat/completions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                content: 'drafted report',
                actionPreview: {
                  type: 'draft_weekly_report',
                  summary: 'draft weekly report',
                  payload: {
                    summary: 'report-summary-ai',
                    wins: 'report-wins-ai',
                    blockers: 'report-blockers-ai',
                    adjustments: 'report-adjustments-ai',
                  },
                },
              }),
            },
          },
        ],
      }),
    });
  });

  await page.getByTestId('ai-input').fill('draft weekly report');
  await page.getByTestId('ai-input').press('Enter');
  await expect(page.getByText('draft weekly report').first()).toBeVisible();
  await page.getByTestId('ai-apply-preview').click();

  await page.getByTestId('nav-weekly-report').click();
  await expect(page.getByTestId('weekly-report-summary')).toHaveValue('report-summary-ai');
});

test('floating settings view updates local preferences in a dedicated window route', async ({ page }) => {
  await page.goto('/?view=floating-settings');

  await expect(page.getByTestId('floating-settings-view')).toBeVisible();
  await page.getByTestId('floating-theme-sage').click();
  await page.getByTestId('floating-opacity-input').fill('0.9');

  const preferences = await page.evaluate(() => localStorage.getItem('floating-pomodoro-preferences'));
  expect(preferences).toContain('"theme":"sage"');
  expect(preferences).toContain('"opacity":0.9');
});

test('floating settings update the live floating window appearance', async ({ browser }) => {
  const context = await browser.newContext();
  const floatingPage = await context.newPage();
  const settingsPage = await context.newPage();

  await floatingPage.goto('/?view=floating');
  await settingsPage.goto('/?view=floating-settings');
  await settingsPage.getByTestId('floating-theme-graphite').click();
  await settingsPage.getByTestId('floating-opacity-input').fill('0.45');

  await expect(floatingPage.getByTestId('floating-shell')).toHaveAttribute('data-theme', 'graphite');
  await expect(floatingPage.getByTestId('floating-shell')).toHaveCSS('opacity', '0.45');
  await context.close();
});

test('floating pomodoro view renders timer and controls', async ({ page }) => {
  await page.goto('/?view=floating');

  await expect(page.getByTestId('floating-shell')).toBeVisible();
  await expect(page.getByTestId('floating-timer')).toHaveText('25:00');
  await expect(page.getByTestId('floating-toggle')).toBeVisible();
});

test('floating pomodoro view migrates legacy theme preferences without blanking', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('floating-pomodoro-preferences', JSON.stringify({ theme: 'slate', opacity: 0.94 }));
  });

  await page.goto('/?view=floating');
  await expect(page.getByTestId('floating-shell')).toBeVisible();
  await expect(page.getByTestId('floating-timer')).toHaveText('25:00');

  const preferences = await page.evaluate(() => localStorage.getItem('floating-pomodoro-preferences'));
  expect(preferences).toContain('"theme":"graphite"');
  expect(preferences).toContain('"opacity":0.94');
});

test('floating pomodoro mini mode renders compact timer bar', async ({ page }) => {
  await page.goto('/?view=floating&mode=mini');

  await expect(page.getByTestId('floating-shell')).toBeVisible();
  await expect(page.getByTestId('floating-timer')).toHaveText('25:00');
  await expect(page.getByTestId('floating-toggle')).toBeVisible();
});

test('floating pomodoro can switch from standard window to mini bar without disappearing', async ({ page }) => {
  await page.goto('/?view=floating');

  await expect(page.getByTestId('floating-shell')).toBeVisible();
  await page.getByTestId('floating-mini-switch').click();
  await expect(page.getByTestId('floating-standard-switch')).toBeVisible();
  await expect(page.getByTestId('floating-timer')).toHaveText('25:00');
});

test('floating pomodoro reflects task binding changes from the main window', async ({ browser }) => {
  const { context, mainPage, floatingPage } = await openFloatingPair(browser);

  await mainPage.getByTestId('today-quick-add-input').fill('floating-sync-task');
  await mainPage.getByTestId('today-quick-add-button').click();
  await mainPage.getByTestId('nav-pomodoro').click();
  await mainPage.getByTestId('pomodoro-task-select').selectOption({ label: 'floating-sync-task' });

  await expect(floatingPage.getByText('floating-sync-task')).toBeVisible();
  await context.close();
});

test('floating view stores window size separately for standard and mini modes', async ({ page }) => {
  await page.goto('/?view=floating');
  await page.setViewportSize({ width: 420, height: 220 });
  await expect(page.getByTestId('floating-shell')).toBeVisible();

  await page.getByTestId('floating-mini-switch').click();
  await page.setViewportSize({ width: 320, height: 64 });

  const standard = await page.evaluate(() => localStorage.getItem('floating-pomodoro-size-standard'));
  const mini = await page.evaluate(() => localStorage.getItem('floating-pomodoro-size-mini'));

  expect(standard).toContain('"width":420');
  expect(mini).toContain('"height":');
});

test('pomodoro skip requires a hold before switching mode', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('nav-pomodoro').click();
  await expect(page.getByText('25:00')).toBeVisible();
  await page.getByTestId('pomodoro-skip-hold').dispatchEvent('mousedown');
  await page.waitForTimeout(1000);
  await page.getByTestId('pomodoro-skip-hold').dispatchEvent('mouseup');

  await expect(page.getByText('05:00')).toBeVisible();
});

test('floating skip requires a hold and work/rest colors differ', async ({ page }) => {
  await page.goto('/?view=floating');

  const workBackground = await page.getByTestId('floating-frame').evaluate((element) => getComputedStyle(element).backgroundImage);
  await page.getByTestId('floating-skip-hold').dispatchEvent('mousedown');
  await page.waitForTimeout(1000);
  await page.getByTestId('floating-skip-hold').dispatchEvent('mouseup');

  await expect(page.getByTestId('floating-timer')).toHaveText('05:00');
  const breakBackground = await page.getByTestId('floating-frame').evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(workBackground).not.toBe(breakBackground);
});

test('mini floating context menu stays fully visible', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 90 });
  await page.goto('/?view=floating&mode=mini');
  await page.getByTestId('floating-shell').click({ button: 'right', position: { x: 330, y: 40 } });

  await expect(page.getByTestId('floating-menu-standard')).toBeVisible();
  await expect(page.getByTestId('floating-menu-hide')).toBeVisible();
});

