const fs = require('fs');
const path = require('path');
const http = require('http');

const OUT = path.resolve('outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'hello_qa');
const RAW = path.join(OUT, '_raw_json_hidden');
const ARCHIVE = path.join(OUT, '_hello_qa_archive.json');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';

const hiddenCategories = [
  { id: '5', title: 'カントリー・ガールズ（旧Q&A）', color: '7f8c8d' },
  { id: '6', title: 'こぶしファクトリー（旧Q&A）', color: 'b87333' },
  { id: '124', title: 'こぶしファクトリー（旧Q&A 2）', color: 'b87333' },
];

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(url, tries = 3) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      headers: {
        'User-Agent': UA,
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json,*/*',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', async () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 500 && tries > 1) {
          await sleep(400);
          try { resolve(await requestJson(url, tries - 1)); } catch (err) { reject(err); }
          return;
        }
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, json, text });
      });
    });
    req.on('error', async (err) => {
      if (tries > 1) {
        await sleep(400);
        try { resolve(await requestJson(url, tries - 1)); } catch (retryErr) { reject(retryErr); }
      } else {
        reject(err);
      }
    });
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function enc(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function stripTags(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function getJson(url) {
  const res = await requestJson(url);
  if (res.status !== 200 || !res.json) throw new Error(`${res.status} ${url}: ${res.text.slice(0, 80)}`);
  return res.json;
}

function saveJson(name, data) {
  mkdirp(RAW);
  fs.writeFileSync(path.join(RAW, name), JSON.stringify(data, null, 2), 'utf8');
}

(async () => {
  mkdirp(RAW);
  const archive = JSON.parse(fs.readFileSync(ARCHIVE, 'utf8'));
  const existing = new Set(archive.items.map((item) => `${item.category_id}:${item.content_id}`));
  const existingContent = new Set(archive.items.map((item) => String(item.content_id)));
  const found = [];
  const skippedExistingContent = [];
  const failed = [];

  for (const cat of hiddenCategories) {
    let page = 1;
    while (true) {
      const listUrl = `http://helloproject-mobile.com/api/contents?${enc({ category_id: cat.id, page })}`;
      const list = await getJson(listUrl);
      saveJson(`contents_${cat.id}_page_${page}.json`, list);
      const contents = list.contents || [];
      if (!contents.length) break;

      for (const item of contents) {
        const key = `${cat.id}:${item.content_id}`;
        if (existing.has(key)) continue;
        if (existingContent.has(String(item.content_id))) {
          skippedExistingContent.push({ category_id: cat.id, content_id: String(item.content_id), title: item.content_title });
          continue;
        }
        try {
          const detailUrl = `http://helloproject-mobile.com/api/contents/${item.content_id}?${enc({
            idx: item.idx,
            page,
            category_id: cat.id,
            menu_id: 6,
          })}`;
          const commentsUrl = `http://helloproject-mobile.com/api/comments?${enc({ order: true, content_id: item.content_id })}`;
          const detail = await getJson(detailUrl);
          const comments = await getJson(commentsUrl);
          saveJson(`detail_${cat.id}_${item.content_id}.json`, detail);
          saveJson(`comments_${cat.id}_${item.content_id}.json`, comments);
          if (!(comments.comments || []).length) continue;
          found.push({
            category_id: cat.id,
            category_title: cat.title,
            category_color: cat.color,
            idx: item.idx,
            content_id: String(item.content_id),
            title: item.content_title || detail.content?.content_title || '',
            subtitle: item.content_sub_title || detail.content?.content_sub_title || '',
            release_date: detail.content?.release_date || item.release_date || '',
            created_at: detail.content?.created_at || item.created_at || '',
            updated_at: detail.content?.updated_at || item.updated_at || '',
            content_text: stripTags(detail.content?.content_text || ''),
            url: `http://helloproject-mobile.com/content/qa/detail?content_id=${item.content_id}&menu_id=6&category_id=${cat.id}&idx=${item.idx}`,
            hidden_category: true,
            comments: (comments.comments || []).map((comment) => ({
              ...comment,
              comment_plain: stripTags(comment.comment_text),
              image_url: comment.artist_id && String(comment.artist_id) !== '0' ? `/images/artist_thumbnail/${comment.artist_id}.jpg` : '',
              local_image: comment.artist_id && String(comment.artist_id) !== '0' ? `assets/images/artist_thumbnail/${comment.artist_id}.jpg` : '',
              hidden_category: true,
            })),
          });
        } catch (err) {
          failed.push({ category_id: cat.id, content_id: String(item.content_id), title: item.content_title, error: err.message });
        }
      }

      if (!list.hasNext) break;
      page += 1;
      await sleep(100);
    }
  }

  archive.items.push(...found);
  archive.items.sort((a, b) => String(b.release_date).localeCompare(String(a.release_date)));
  archive.content_count = archive.items.length;
  archive.hidden_qa = {
    generated_at: new Date().toISOString(),
    added_items: found.length,
    skipped_existing_content: skippedExistingContent.length,
    failed: failed.length,
    categories: hiddenCategories,
  };
  fs.writeFileSync(ARCHIVE, JSON.stringify(archive, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, '_hidden_hello_qa_report.json'), JSON.stringify({
    generated_at: new Date().toISOString(),
    added_items: found.length,
    added_answers: found.reduce((sum, item) => sum + item.comments.length, 0),
    by_category: hiddenCategories.map((cat) => ({
      category_id: cat.id,
      category_title: cat.title,
      items: found.filter((item) => item.category_id === cat.id).length,
      answers: found.filter((item) => item.category_id === cat.id).reduce((sum, item) => sum + item.comments.length, 0),
    })),
    skipped_existing_content: skippedExistingContent,
    failed,
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    added_items: found.length,
    added_answers: found.reduce((sum, item) => sum + item.comments.length, 0),
    skipped_existing_content: skippedExistingContent.length,
    failed: failed.length,
  }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
