import { expect, test, type Page } from '@playwright/test';

const openFreshApp = async (page: Page, options?: { skipGuide?: boolean }) => {
  await page.goto('/');
  await page.evaluate((skipGuide) => {
    localStorage.clear();
    sessionStorage.clear();
    if (skipGuide) localStorage.setItem('daily-planner-guide-v2-seen', '1');
  }, options?.skipGuide ?? true);
  await page.reload();
};

const configureAI = async (page: Page) => {
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-ai-api-key').fill('test-api-key');
  await page.getByTestId('settings-ai-base-url').fill('https://example.com/v1');
  await page.getByTestId('settings-ai-model').fill('gpt-test-model');
  await page.getByRole('button', { name: /close/i }).first().click();
};

test('inbox capture can be clarified and moved into today', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('nav-inbox').click();
  await page.getByTestId('inbox-capture-input').fill('prepare launch checklist');
  await page.getByTestId('inbox-capture-save').click();
  await expect(page.getByText('prepare launch checklist')).toBeVisible();

  await page.locator('[data-testid^="inbox-estimate-"]').first().selectOption('60');
  await page.locator('[data-testid^="inbox-type-"]').first().selectOption('deep');
  await page.locator('[data-testid^="inbox-state-"]').first().selectOption('today');

  await page.getByTestId('nav-today').click();
  await expect(page.getByText('prepare launch checklist').first()).toBeVisible();
  await page.getByTestId('today-highlight-start').click();
  await expect(page.getByTestId('today-focus-timer')).toBeVisible();
});

test('ai inbox triage can create multiple task drafts after confirmation', async ({ page }) => {
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
                content: '我帮你拆成两个动作，一个放今天，一个留在稍后。',
                actionPreview: {
                  type: 'triage_inbox',
                  summary: '创建 2 个 inbox 草案',
                  payload: {
                    tasks: [
                      { title: 'draft investor update', estimatedMinutes: 60, taskType: 'deep', planningState: 'today' },
                      { title: 'send March invoice', estimatedMinutes: 15, taskType: 'shallow', planningState: 'later' },
                    ],
                  },
                },
              }),
            },
          },
        ],
      }),
    });
  });

  await page.getByTestId('nav-inbox').click();
  await page.getByTestId('inbox-ai-triage-input').fill('today draft investor update and send March invoice later this week');
  await page.getByTestId('inbox-ai-triage-send').click();
  await expect(page.getByText('创建 2 个 inbox 草案')).toBeVisible();
  await page.getByTestId('inbox-ai-triage-apply').click();

  await expect(page.getByText('send March invoice')).toBeVisible();
  await page.getByTestId('nav-today').click();
  await expect(page.getByText('draft investor update').first()).toBeVisible();
});

test('ai daily plan can choose a highlight from existing today tasks', async ({ page }) => {
  await openFreshApp(page);
  await configureAI(page);

  await page.getByTestId('nav-inbox').click();
  await page.getByTestId('inbox-capture-input').fill('write project brief');
  await page.getByTestId('inbox-capture-save').click();
  await page.getByTestId('inbox-capture-input').fill('reply to client email');
  await page.getByTestId('inbox-capture-save').click();
  await page.locator('[data-testid^="inbox-state-"]').nth(0).selectOption('today');
  await page.locator('[data-testid^="inbox-state-"]').nth(0).selectOption('today');

  const taskIds = await page.evaluate(() => {
    const raw = localStorage.getItem('daily-planner-storage-v8') || localStorage.getItem('daily-planner-storage-v7');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const tasks = parsed.state?.tasks || [];
    return tasks.map((task: { id: string }) => task.id);
  });

  await page.route('https://example.com/v1/chat/completions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                content: '建议把项目 brief 设为今日 highlight，邮件作为 support task。',
                actionPreview: {
                  type: 'plan_today',
                  summary: '设置今日 highlight 和 support tasks',
                  payload: {
                    highlightTaskId: taskIds[0],
                    supportTaskIds: [taskIds[1]],
                  },
                },
              }),
            },
          },
        ],
      }),
    });
  });

  await page.getByTestId('nav-today').click();
  await page.getByTestId('today-ai-plan-input').fill('pick today highlight');
  await page.getByTestId('today-ai-plan-send').click();
  await page.getByTestId('today-ai-plan-apply').click();

  await expect(page.getByRole('heading', { name: 'Highlight' })).toBeVisible();
  await expect(page.getByText('write project brief').first()).toBeVisible();
});

test('review workspace can carry a today task forward manually', async ({ page }) => {
  await openFreshApp(page);

  await page.getByTestId('nav-inbox').click();
  await page.getByTestId('inbox-capture-input').fill('unfinished review task');
  await page.getByTestId('inbox-capture-save').click();
  await page.locator('[data-testid^="inbox-state-"]').first().selectOption('today');

  await page.getByTestId('nav-review').click();
  await expect(page.getByText('unfinished review task')).toBeVisible();
  await page.locator('[data-testid^="review-later-"]').first().click();

  await expect(page.getByText('unfinished review task')).toHaveCount(0);
  await page.getByTestId('nav-today').click();
  await expect(page.getByRole('button', { name: /add to support/i })).toBeVisible();
});

test('floating pomodoro view still renders timer and controls', async ({ page }) => {
  await page.goto('/?view=floating');

  await expect(page.getByTestId('floating-shell')).toBeVisible();
  await expect(page.getByTestId('floating-timer')).toHaveText('60:00');
  await expect(page.getByTestId('floating-toggle')).toBeVisible();
});

test('quick tour appears on first launch and can be reopened later', async ({ page }) => {
  await openFreshApp(page, { skipGuide: false });

  await expect(page.getByText('New workflow, less overhead')).toBeVisible();
  await expect(page.getByText('You capture')).toBeVisible();
  await page.getByTestId('guide-next').click();
  await expect(page.getByText('Today is only 1 highlight + 2 support tasks')).toBeVisible();
  await page.getByTestId('guide-next').click();
  await expect(page.getByText('Close the day before you leave')).toBeVisible();
  await page.getByTestId('guide-finish').click();
  await expect(page.getByText('New workflow, less overhead')).toHaveCount(0);

  await page.getByTestId('open-guide').click();
  await expect(page.getByText('New workflow, less overhead')).toBeVisible();
});
