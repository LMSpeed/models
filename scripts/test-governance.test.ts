import { describe, expect, it } from 'vitest';
import { inspectTestSource } from './test-governance';

describe('user receives behavior evidence instead of mocked or empty tests', () => {
  it('user rejects aliased mocks, missing acceptance stages and focused runs', () => {
    // Given a test using imported aliases to hide invalid testing practices.
    const source = `import {it as scenario,vi as toolkit} from 'vitest';scenario.only('accepts payment',()=>{toolkit.mock('billing');expect(true).toBeTruthy();});`;
    // When the repository checks the actual syntax tree before CI execution.
    const rules = inspectTestSource(source, 'payment.test.ts').map(
      (finding) => finding.rule,
    );
    // Then the violations remain visible through aliases and cannot be merged as behavior evidence.
    expect(rules).toEqual(
      expect.arrayContaining([
        'focus-or-skip',
        'user-title',
        'given-when-then',
        'mock',
        'empty-assertion',
      ]),
    );
  });
  it('user accepts real behavior tests without treating quoted mock examples as execution', () => {
    // Given real entry-point assertions and a quoted example used as ordinary input data.
    const source = `import {test as scenario} from '@playwright/test';scenario('user saves an order @orders',async({page})=>{ // Given a real order form.\n const example="vi.mock('billing')"; // When the user submits the order.\n await page.getByRole('button',{name:'Save'}).click(); // Then the persisted order is visible.\n await expect(page.getByText('Saved')).toBeVisible();});`;
    // When the same AST checks inspect test descriptions, comments and calls.
    const violations = inspectTestSource(source, 'orders.spec.ts');
    // Then source examples are not mistaken for mocks and valid acceptance evidence passes.
    expect(violations).toEqual([]);
  });
  it('user checks parameterized acceptance titles and accepts explicit test steps', () => {
    // Given aliased parameterized tests and a real step-based browser scenario.
    const invalid =
      "import {it as scenario} from 'vitest';scenario.each([1,2])('saves %s',()=>{});";
    const valid =
      "import {test} from '@playwright/test';test('user saves a record @records',async()=>{await test.step('Given a saved form',async()=>{});await test.step('When user submits',async()=>{});await test.step('Then record is visible',async()=>{});});";
    // When syntax-aware governance checks each actual case and its acceptance steps.
    const parameterized = inspectTestSource(invalid, 'records.test.ts');
    const steps = inspectTestSource(valid, 'records.spec.ts');
    // Then factory arguments cannot hide invalid titles and explicit stages remain valid.
    expect(parameterized.map((item) => item.rule)).toContain('user-title');
    expect(steps).toEqual([]);
  });
});
