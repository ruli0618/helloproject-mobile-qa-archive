(() => {
  const script = document.currentScript;
  if (!script || document.querySelector('.archive-shell')) return;
  const root = new URL('.', script.src);
  const routes = [
    ['一覧', 'archive.html'],
    ['Q&A', 'hello_qa/index.html'],
    ['ペディア', 'hello_pedia/index.html'],
    ['日記', 'tour_diary/index.html'],
    ['連載', 'extra_content/index.html'],
    ['特設', 'special_events/index.html'],
    ['動画', 'hello_pedia/media.html'],
    ['ラジオ', 'radio/index.html'],
    ['メール', 'mail/index.html'],
    ['誕生日', 'birthday_cards/index.html'],
  ];
  const current = new URL(location.href);
  const active = current.pathname.includes('/extra_content/menu-') ? 'extra_content/index.html' :
    routes.find(([, route]) => current.pathname.endsWith(`/${route}`))?.[1];
  const shell = document.createElement('div');
  shell.className = 'archive-shell';
  const inner = document.createElement('div');
  inner.className = 'archive-shell-inner';
  const brand = document.createElement('a');
  brand.className = 'archive-shell-brand';
  brand.href = new URL('archive.html', root).href;
  brand.innerHTML = '<span class="archive-shell-mark">H!M</span><span>ハロモバ保存アーカイブ</span>';
  const nav = document.createElement('div');
  nav.className = 'archive-shell-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'アーカイブ');
  for (const [label, route] of routes) {
    const link = document.createElement('a');
    link.href = new URL(route, root).href;
    link.textContent = label;
    if (route === active) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  inner.append(brand, nav);
  shell.append(inner);
  document.body.prepend(shell);
})();
