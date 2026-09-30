# ハロモバ保存アーカイブ

ハロ！プロモバイルの保存済みコンテンツを閲覧するための非公式静的サイトです。

[公開サイト](https://ruli0618.github.io/helloproject-mobile-qa-archive/)から、Q&A、ハローペディア、ツアー日記、連載、特設イベント、妄想動画、ラジオ、メール、バースデーカードへ移動できます。

ローカルでは `index.html` を開くか、`outputs/helloproject-mobile-archive/helloproject-mobile.com/archive.html` を開いてください。各カテゴリの検索や絞り込みはブラウザ内で動作します。

入口・共通ナビ・誕生日一覧・連載一覧を再生成する場合:

```sh
node work/build_archive_hub.js
```

一部の画像と元サイトから取得できなかった内容は含まれません。ラジオの音声原本など、GitHubに載せていない大容量データはローカル側でも保管してください。
