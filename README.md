# 売上報告アプリ

HTML・CSS・JavaScriptだけで動く、GitHub Pages向けの静的Webアプリです。

## 商品の変更

`products.json` をテキストエディタで開き、通常メニュー・シーズンメニューの商品を追加・変更・削除します。

```json
{
  "id": "regular",
  "name": "通常メニュー",
  "products": [
    { "id": "egg-sand", "商品名": "たまごサンド", "販売上限": 100 }
  ]
}
```

- グループの `id`: メニュー区分ごとに重複しない半角英数字のID
- グループの `name`: 「通常メニュー」などの見出し
- 商品の `id`: 商品ごとに重複しない半角英数字のID
- 商品の `商品名`: 表に表示する商品名
- 商品の `販売上限`: 入力できる最大数（0以上の整数）

## ローカルで確認

`products.json` を読み込むため、`index.html` を直接ダブルクリックするのではなく、
ローカルWebサーバーから開いてください。

Pythonがある場合：

```powershell
python -m http.server 8000
```

ブラウザで `http://localhost:8000` を開きます。

## GitHub Pagesで公開

1. このフォルダーのファイルをGitHubリポジトリへ登録します。
2. リポジトリの「Settings」→「Pages」を開きます。
3. 「Deploy from a branch」を選択します。
4. 公開元を `main` ブランチの `/ (root)` に設定します。

以後、`products.json` を更新してGitHubへ反映すると商品情報も更新されます。
