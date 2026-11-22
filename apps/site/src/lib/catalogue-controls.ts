const search = document.querySelector<HTMLInputElement>('#search');
const developer = document.querySelector<HTMLSelectElement>('#developer');
const task = document.querySelector<HTMLSelectElement>('#task');
const weights = document.querySelector<HTMLSelectElement>('#weights');
const body = document.querySelector<HTMLTableSectionElement>('#model-rows');
const form = document.querySelector<HTMLFormElement>('#filters');
if (search && developer && task && weights && body && form) {
  const rows = Array.from(body.querySelectorAll<HTMLTableRowElement>('tr'));
  const params = new URLSearchParams(location.search);
  let sort = params.get('sort') ?? 'released';
  let descending = params.get('direction') !== 'asc';
  for (const field of [search, developer, task, weights]) {
    field.value = params.get(field.name) ?? '';
    if (field instanceof HTMLSelectElement && field.selectedIndex < 0)
      field.value = '';
  }
  const refresh = () => {
    const query = search.value.trim().toLocaleLowerCase('en');
    let count = 0;
    for (const row of rows) {
      const matches =
        (!query || row.dataset.search?.includes(query)) &&
        (!developer.value || row.dataset.developer === developer.value) &&
        (!task.value || row.dataset.task?.split(' ').includes(task.value)) &&
        (!weights.value || row.dataset.weights === weights.value);
      row.hidden = !matches;
      if (matches) count++;
    }
    const counter = document.querySelector('#result-count');
    if (counter) counter.textContent = String(count);
    const empty = document.querySelector<HTMLElement>('#empty-state');
    if (empty) empty.hidden = count !== 0;
    const url = new URL(location.href);
    for (const field of [search, developer, task, weights]) {
      if (field.value) url.searchParams.set(field.name, field.value);
      else url.searchParams.delete(field.name);
    }
    url.searchParams.set('sort', sort);
    url.searchParams.set('direction', descending ? 'desc' : 'asc');
    history.replaceState(null, '', url);
  };
  const order = () => {
    const key = sort.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase(),
    );
    const numeric = [
      'context',
      'maxOutput',
      'parameters',
      'reasoning',
      'tools',
    ].includes(key);
    const sorted = [...rows].sort((a, b) => {
      const left = a.dataset[key] ?? '';
      const right = b.dataset[key] ?? '';
      if (!left && right) return 1;
      if (left && !right) return -1;
      const result = numeric
        ? Number(left) - Number(right)
        : left.localeCompare(right, 'en', { numeric: true });
      return (
        (descending ? -result : result) ||
        a.dataset.model!.localeCompare(b.dataset.model!, 'en')
      );
    });
    body.append(...sorted);
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      '[data-sort]',
    )) {
      const active = button.dataset.sort === sort;
      button
        .closest('th')
        ?.setAttribute(
          'aria-sort',
          active ? (descending ? 'descending' : 'ascending') : 'none',
        );
      const icon = button.querySelector('.sort-icon');
      if (icon) icon.textContent = active ? (descending ? '↓' : '↑') : '↕';
    }
  };
  for (const input of [search, developer, task, weights])
    input.addEventListener(input === search ? 'input' : 'change', refresh);
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('reset', () => {
    for (const field of [search, developer, task, weights]) field.value = '';
    refresh();
    search.focus();
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '[data-sort]',
  ))
    button.addEventListener('click', () => {
      const next = button.dataset.sort ?? 'name';
      descending =
        sort === next
          ? !descending
          : ['context', 'maxOutput', 'parameters', 'released'].includes(next);
      sort = next;
      order();
      refresh();
    });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search.focus();
    }
  });
  order();
  refresh();
}
document
  .querySelector<HTMLSelectElement>('#language')
  ?.addEventListener('change', (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    const target = new URL(location.href);
    target.pathname = select.value;
    location.assign(target);
  });
document.querySelector('#theme')?.addEventListener('click', () => {
  const dark =
    document.documentElement.classList.contains('dark') ||
    (!document.documentElement.classList.contains('light') &&
      matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.classList.toggle('dark', !dark);
  document.documentElement.classList.toggle('light', dark);
});
