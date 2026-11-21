// Power Apps 演習用のアプリ（データソース・画面・コントロール）
// props の値はすべて Power Fx の数式（文字列）。template = ギャラリーの中のコントロール

const EXPENSES = [
  { ID: 1, 件名: '大阪出張 新幹線代', 申請者: '田中 誠', 部署: '営業部', 金額: 28400, 区分: '交通費', ステータス: '承認待ち', 申請日: '2026-05-07' },
  { ID: 2, 件名: '会議用お茶菓子', 申請者: '伊藤 恵', 部署: '営業部', 金額: 3500, 区分: '会議費', ステータス: '承認済み', 申請日: '2026-05-08' },
  { ID: 3, 件名: 'タクシー代（顧客訪問）', 申請者: '田中 誠', 部署: '営業部', 金額: 2800, 区分: '交通費', ステータス: '差し戻し', 申請日: '2026-05-12' },
  { ID: 4, 件名: 'プリンタートナー', 申請者: '小林 翔', 部署: '総務部', 金額: 12800, 区分: '消耗品費', ステータス: '承認待ち', 申請日: '2026-05-15' },
  { ID: 5, 件名: 'Power BI 入門書', 申請者: '吉田 彩', 部署: '開発部', 金額: 3080, 区分: '書籍代', ステータス: '承認済み', 申請日: '2026-05-18' },
  { ID: 6, 件名: '福岡出張 航空券', 申請者: '伊藤 恵', 部署: '営業部', 金額: 41200, 区分: '交通費', ステータス: '承認待ち', 申請日: '2026-05-21' },
  { ID: 7, 件名: '展示会 入場料', 申請者: '山本 健', 部署: '開発部', 金額: 5000, 区分: '会議費', ステータス: '承認済み', 申請日: '2026-05-26' },
  { ID: 8, 件名: '電車代（研修会場）', 申請者: '山本 健', 部署: '開発部', 金額: 1240, 区分: '交通費', ステータス: '承認待ち', 申請日: '2026-06-02' },
  { ID: 9, 件名: 'コピー用紙', 申請者: '小林 翔', 部署: '総務部', 金額: 4600, 区分: '消耗品費', ステータス: '承認済み', 申請日: '2026-06-04' },
  { ID: 10, 件名: '技術書 2冊', 申請者: '吉田 彩', 部署: '開発部', 金額: 7480, 区分: '書籍代', ステータス: '差し戻し', 申請日: '2026-06-09' },
];
const STAFF = [
  { 社員番号: 'E001', 氏名: '田中 誠', 部署: '営業部', 役職: '課長', 内線: 101, メール: 'tanaka@contoso.co.jp' },
  { 社員番号: 'E002', 氏名: '伊藤 恵', 部署: '営業部', 役職: '主任', 内線: 102, メール: 'ito@contoso.co.jp' },
  { 社員番号: 'E003', 氏名: '小林 翔', 部署: '総務部', 役職: '一般', 内線: 201, メール: 'kobayashi@contoso.co.jp' },
  { 社員番号: 'E004', 氏名: '吉田 彩', 部署: '開発部', 役職: '課長', 内線: 301, メール: 'yoshida@contoso.co.jp' },
  { 社員番号: 'E005', 氏名: '山本 健', 部署: '開発部', 役職: '一般', 内線: 302, メール: 'yamamoto@contoso.co.jp' },
];
const PRODUCTS = [
  { ID: 1, 商品名: 'コーヒー豆', カテゴリ: 'ドリンク', 単価: 1500, 在庫: 12 },
  { ID: 2, 商品名: '紅茶ティーバッグ', カテゴリ: 'ドリンク', 単価: 600, 在庫: 0 },
  { ID: 3, 商品名: '緑茶ボトル', カテゴリ: 'ドリンク', 単価: 150, 在庫: 48 },
  { ID: 4, 商品名: 'チョコレート', カテゴリ: '菓子', 単価: 300, 在庫: 30 },
  { ID: 5, 商品名: 'クッキー', カテゴリ: '菓子', 単価: 450, 在庫: 0 },
  { ID: 6, 商品名: 'ノート', カテゴリ: '文具', 単価: 220, 在庫: 150 },
  { ID: 7, 商品名: 'ボールペン', カテゴリ: '文具', 単価: 120, 在庫: 200 },
  { ID: 8, 商品名: 'マグカップ', カテゴリ: '雑貨', 単価: 1200, 在庫: 6 },
];

export const APPS = {
  expense: {
    title: '経費申請アプリ',
    sourceInfo: { 経費申請: 'SharePoint リスト', 社員: 'Excel（OneDrive）' },
    data: { 経費申請: EXPENSES, 社員: STAFF },
    delegable: ['経費申請'],
    screens: [
      { name: '一覧画面', controls: [
        { type: 'Label', name: 'タイトル', props: { Text: '"経費申請一覧"', Size: '18', FontWeight: 'FontWeight.Bold' } },
        { type: 'TextInput', name: 'TextInput1', props: { Default: '""', HintText: '"件名・申請者で検索"' } },
        { type: 'Dropdown', name: 'Dropdown1', props: { Items: '["すべて", "承認待ち", "承認済み", "差し戻し"]' } },
        { type: 'Toggle', name: 'Toggle1', props: { Default: 'false', Text: '"金額の大きい順"' } },
        { type: 'Gallery', name: 'Gallery1', props: { Items: '経費申請', OnSelect: '' }, template: [
          { type: 'Label', name: 'Title1', props: { Text: 'ThisItem.件名', FontWeight: 'FontWeight.Bold' } },
          { type: 'Label', name: 'Subtitle1', props: { Text: 'ThisItem.申請者 & " / " & Text(ThisItem.金額, "¥#,##0")' } },
          { type: 'Label', name: 'Status1', props: { Text: 'ThisItem.ステータス', Color: 'Color.Gray' } },
        ] },
        { type: 'Label', name: 'Label1', props: { Text: '""' } },
        { type: 'Button', name: 'Button1', props: { Text: '"承認する"', OnSelect: '' } },
      ] },
      { name: '詳細画面', controls: [
        { type: 'Label', name: '詳細タイトル', props: { Text: 'Gallery1.Selected.件名', Size: '18', FontWeight: 'FontWeight.Bold' } },
        { type: 'Label', name: '詳細金額', props: { Text: 'Text(Gallery1.Selected.金額, "¥#,##0")' } },
        { type: 'Label', name: '詳細日付', props: { Text: '""' } },
        { type: 'Button', name: '戻るボタン', props: { Text: '"＜ 戻る"', OnSelect: 'Back()' } },
      ] },
      { name: '申請画面', controls: [
        { type: 'Label', name: '申請見出し', props: { Text: '"新しい申請"', Size: '18', FontWeight: 'FontWeight.Bold' } },
        { type: 'TextInput', name: 'txt件名', props: { Default: '""', HintText: '"件名"' } },
        { type: 'TextInput', name: 'txt金額', props: { Default: '""', HintText: '"金額（数字）"' } },
        { type: 'Dropdown', name: 'drp区分', props: { Items: '["交通費", "会議費", "消耗品費", "書籍代"]' } },
        { type: 'Button', name: 'btn送信', props: { Text: '"申請する"', OnSelect: '' } },
        { type: 'Label', name: 'lblメッセージ', props: { Text: '""', Color: 'Color.Red' } },
      ] },
    ],
  },
  catalog: {
    title: '備品カタログアプリ',
    sourceInfo: { 商品: 'Dataverse テーブル', カート: 'コレクション' },
    data: { 商品: PRODUCTS },
    collections: { カート: [] },
    delegable: [],
    screens: [
      { name: '商品画面', controls: [
        { type: 'Label', name: '見出し', props: { Text: '"備品カタログ"', Size: '18', FontWeight: 'FontWeight.Bold' } },
        { type: 'Dropdown', name: 'drpカテゴリ', props: { Items: '["すべて", "ドリンク", "菓子", "文具", "雑貨"]' } },
        { type: 'Toggle', name: 'tgl在庫あり', props: { Default: 'false', Text: '"在庫ありのみ"' } },
        { type: 'Gallery', name: 'galProducts', props: { Items: '商品' }, template: [
          { type: 'Label', name: 'lbl商品名', props: { Text: 'ThisItem.商品名', FontWeight: 'FontWeight.Bold' } },
          { type: 'Label', name: 'lbl単価', props: { Text: 'Text(ThisItem.単価, "¥#,##0")' } },
          { type: 'Label', name: 'lbl在庫', props: { Text: '"在庫 " & ThisItem.在庫' } },
        ] },
        { type: 'Button', name: 'btn追加', props: { Text: '"カートに追加"', OnSelect: '' } },
        { type: 'Label', name: 'lbl合計', props: { Text: '""' } },
      ] },
      { name: 'カート画面', controls: [
        { type: 'Gallery', name: 'galCart', props: { Items: 'カート' }, template: [
          { type: 'Label', name: 'lblカート商品', props: { Text: 'ThisItem.商品名 & " × " & ThisItem.数量' } },
        ] },
        { type: 'Button', name: 'btnクリア', props: { Text: '"カートを空にする"', OnSelect: '' } },
      ] },
    ],
  },
};
