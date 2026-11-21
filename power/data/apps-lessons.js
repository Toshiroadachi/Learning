// Power Apps（キャンバスアプリ・Power Fx）コース
// ex: app = 使うアプリ（apps-screens.js）、target = 数式を書くコントロールとプロパティ、set = 先に設定しておく数式
// tests = 採点で試す入力（TextInput は文字、Dropdown は表示される値、Gallery は選ぶ行の番号、Toggle は true/false）

export const APPS_LESSONS = [
  {
    id: 'ap1', title: 'Power Apps とは？ Studio の画面', goal: 'キャンバスアプリの仕組みと Power Apps Studio の画面を知る',
    body: `### Power Apps はローコードの業務アプリ作成ツール
Excel のように**数式（Power Fx）**を書くだけで、スマホでもPCでも動く業務アプリを作れます。経費申請・備品管理・日報・点検チェックなど、紙や Excel で回していた業務のアプリ化に使われます。

| 種類 | 特徴 |
|---|---|
| **キャンバス アプリ** | 画面に自由にコントロールを配置。このコースで学ぶ |
| モデル駆動型アプリ | Dataverse のデータ構造から画面を自動生成 |

### Power Apps Studio（作成画面）
| 場所 | 役割 |
|---|---|
| ツリー ビュー（左） | 画面とコントロールの一覧（名前を変更できる） |
| 数式バー（上） | 左のプロパティ一覧（Text・Items・OnSelect など）を選んで数式を書く |
| キャンバス（中央） | アプリの画面 |
| プロパティ ペイン（右） | 色・サイズなどを GUI で設定 |
| データ（左のアイコン） | SharePoint・Excel・Dataverse などのデータソースを追加 |

### すべては「プロパティ = 数式」
ラベルの **Text** プロパティに \`"こんにちは"\` と書けば表示が変わり、ボタンの **OnSelect** に動作を書けば押したときに実行されます。Excel のセルに式を入れる感覚です。
> プレビュー（▶ または F5）でアプリを実際に操作できます。Alt キーを押しながらクリックすると、編集中でもボタンなどを操作できます。

このアプリの演習画面は Studio を再現しています。上のプレビューは実際に操作でき（入力・選択・ボタン）、下の数式バーでプロパティの式を書きます。`,
    pc: `1. ブラウザで **make.powerapps.com** を開き、組織のアカウントでサインイン
2. **作成** → **空のアプリ** → **空のキャンバス アプリ**（形式：電話 または タブレット）
3. データから作るなら **作成** → **SharePoint** / **Excel** / **Dataverse** から開始（一覧・詳細・編集画面が自動生成される）
4. **挿入** タブ → テキスト ラベル・テキスト入力・ボタン・ギャラリーなどを追加
5. 左上のプロパティのドロップダウン（例：Text）を選び、右の fx 欄に数式を入力
6. **保存**（Ctrl + S）→ **公開** → **共有** で他の人が使えるようになる`,
    quiz: [
      { q: 'ボタンを押したときの動作を書くプロパティは？', choices: ['OnSelect', 'Text', 'Items', 'Default'], a: 0, exp: '「On〜」で始まるプロパティは動作（イベント）。OnSelect はタップ・クリック時です。' },
      { q: 'Power Apps の数式言語の名前は？', choices: ['Power Fx', 'DAX', 'M 言語', 'VBA'], a: 0, exp: 'Excel の数式をベースにした Power Fx です。' },
      { q: '編集中にボタンを押して動作を試すには？', choices: ['Alt キーを押しながらクリック（またはプレビュー）', 'ダブルクリック', '右クリック', 'Ctrl + Enter'], a: 0, exp: 'Alt + クリックか、プレビュー（F5）で操作できます。' },
    ],
    ex: [
      { id: 'ap1a', title: 'ラベルに表示する', app: 'expense', target: { control: 'Label1', prop: 'Text' },
        prompt: 'Label1 の Text に「ようこそ、（ユーザー名） さん」と表示してください。ユーザー名は User().FullName で取れます。例: ようこそ、山田 太郎 さん',
        hint: 'テキストは " " で囲み、& でつなぎます。"ようこそ、" & User().FullName & " さん"',
        starter: '""', solution: '"ようこそ、" & User().FullName & " さん"' },
    ],
  },
  {
    id: 'ap2', title: 'Power Fx の基本（Excel との違い）', goal: '値・演算子・コントロールの参照・型変換の基本を押さえる',
    body: `### 値と演算子
| 書き方 | 意味 |
|---|---|
| "文字" | テキスト（" " で囲む） |
| 123、1.5 | 数値 |
| true / false | ブール値 |
| & | 文字の結合（"合計" & 100 → "合計100"） |
| + - * / | 計算 |
| = <> < > <= >= | 比較（等しいは = 1つ） |
| && / And、\\|\\| / Or、! / Not | かつ・または・否定 |

### コントロールの値を使う
コントロールは**名前.プロパティ**で参照します（Excel のセル参照の代わり）。
- テキスト入力：\`TextInput1.Text\`
- ドロップダウンの選択：\`Dropdown1.Selected.Value\`
- トグル：\`Toggle1.Value\`（true/false）
入力が変わると、それを参照している数式は**自動で再計算**されます（Excel と同じ）。

### テキスト ⇔ 数値
- \`Value("1200")\` → 1200（入力欄の文字を数値に）
- \`Text(1234.5, "#,##0")\` → "1,235"、\`Text(1200, "¥#,##0")\` → "¥1,200"
- \`Text(Today(), "yyyy/mm/dd")\` → "2026/06/15"

### Excel との違い
- セル参照（A1）はない。コントロール名・変数・データソースを参照する
- 日本語環境でも引数の区切りは **,（カンマ）**、複数の動作をつなぐのは **;（セミコロン）**（地域設定によっては ; と ;; になる）
- 関数名は大文字で始まる（Filter、If、Text…）`,
    pc: `- 数式バーの左のドロップダウンでプロパティを選ぶ。右端の ∨ で数式バーを広げられる
- 数式を書く途中で候補が出る（Tab / Enter で確定）。エラーは赤い波線と ⚠ で表示され、ポイントすると理由がわかる
- **設定** → **全般** で「数式バーの書式設定」を使うと式を整形できる
- コントロール名はツリービューでダブルクリックして変更（例：txt金額、btn送信 のように種類の接頭辞を付けると読みやすい）`,
    quiz: [
      { q: 'テキスト入力 TextInput1 に入力された文字を参照するには？', choices: ['TextInput1.Text', 'TextInput1', 'TextInput1.Value()', 'Text(TextInput1)'], a: 0, exp: 'コントロール名.プロパティ で参照します。テキスト入力は .Text。' },
      { q: '"合計" + 100 と書くと？', choices: ['エラー（文字の結合は &）', '"合計100"', '100', '"合計 100"'], a: 0, exp: '+ は数値の足し算。文字の結合は & を使います。' },
      { q: '入力欄の "1200" を数値として計算に使う関数は？', choices: ['Value', 'Text', 'Number', 'Int'], a: 0, exp: 'Value("1200") で数値になります。逆に数値を書式付きの文字にするのが Text。' },
    ],
    ex: [
      { id: 'ap2a', title: '入力をそのまま表示', app: 'expense', target: { control: 'Label1', prop: 'Text' },
        tests: [{ name: '「交通」と入力', inputs: { TextInput1: '交通' } }, { name: '空のとき', inputs: { TextInput1: '' } }],
        prompt: 'Label1 に「検索語: （TextInput1 に入力した文字）」と表示してください。例: 検索語: 交通',
        hint: '"検索語: " & TextInput1.Text', starter: '""', solution: '"検索語: " & TextInput1.Text' },
      { id: 'ap2b', title: '税込金額を計算', app: 'expense', screen: '申請画面', target: { control: 'lblメッセージ', prop: 'Text' },
        tests: [{ name: '1000 と入力', inputs: { txt金額: '1000' } }, { name: '2480 と入力', inputs: { txt金額: '2480' } }],
        prompt: 'txt金額 に入力した金額の税込（×1.1）を、「税込 ¥1,100」のように表示してください（Text 関数の書式 "¥#,##0" を使う）。',
        hint: '"税込 " & Text(Value(txt金額.Text) * 1.1, "¥#,##0")', starter: '""', solution: '"税込 " & Text(Value(txt金額.Text) * 1.1, "¥#,##0")' },
    ],
  },
  {
    id: 'ap3', title: 'ギャラリーとデータソース', goal: 'データソースをギャラリーに表示し、ThisItem で各行の値を使う',
    body: `### ギャラリー = 一覧表示
ギャラリーの **Items** にテーブル（データソース名など）を指定すると、1行ずつ繰り返し表示されます。
\`\`\`powerfx
経費申請
\`\`\`
### ThisItem
ギャラリーの中（テンプレート）に置いたラベルでは、\`ThisItem.列名\` で**その行の値**を表示します。
\`\`\`powerfx
ThisItem.申請者 & " / " & Text(ThisItem.金額, "¥#,##0")
\`\`\`
### 選択中の行
\`Gallery1.Selected\` は選ばれている行（レコード）。\`Gallery1.Selected.件名\` のように列を取り出せます。詳細画面に選択中の内容を表示するときの定番です。

### データソース
| データソース | 特徴 |
|---|---|
| SharePoint リスト | Microsoft 365 があれば追加費用なしで使える定番 |
| Excel（OneDrive） | 手軽だが同時編集・大量データに弱い（テーブルにしておく必要あり） |
| Dataverse | Power Platform 専用 DB。リレーション・セキュリティが強力（プレミアム） |
| SQL Server など | 大量データ（プレミアム コネクタ） |`,
    pc: `- **データ**（左のシリンダーのアイコン）→ **データの追加** → SharePoint / Excel Online (Business) などを選んで接続
- **挿入** → **垂直ギャラリー** → データソースを選ぶ。右の「レイアウト」でタイトル・サブタイトル付きなどを選べる
- テンプレートの編集：ギャラリーの最初の行の中のラベルを選択（✏ アイコン）して Text を変更すると全行に反映
- 「フィールド」の編集：プロパティ ペインの **フィールド** → 表示する列を選ぶ`,
    quiz: [
      { q: 'ギャラリーの中のラベルで、その行の「件名」を表示する式は？', choices: ['ThisItem.件名', 'Gallery1.件名', '経費申請.件名', 'Selected.件名'], a: 0, exp: 'テンプレート内では ThisItem がその行のレコードです。' },
      { q: 'ギャラリーで選択中の行の金額を、ギャラリーの外のラベルで使うには？', choices: ['Gallery1.Selected.金額', 'ThisItem.金額', 'Gallery1.金額', 'First(Gallery1).金額'], a: 0, exp: '外からは コントロール名.Selected.列名 で参照します。' },
    ],
    ex: [
      { id: 'ap3a', title: 'ギャラリーにデータを表示', app: 'expense', target: { control: 'Gallery1', prop: 'Items' },
        prompt: 'Gallery1 の Items に、データソース「経費申請」を指定して全件を表示してください。',
        hint: 'データソース名をそのまま書くだけ', starter: '', solution: '経費申請' },
      { id: 'ap3b', title: 'テンプレートの表示を変える', app: 'expense', target: { control: 'Subtitle1', prop: 'Text' },
        prompt: 'ギャラリーの中の Subtitle1 に「部署・区分」の形で表示してください（例: 営業部・交通費）。中黒（・）は全角です。',
        hint: 'ThisItem.部署 & "・" & ThisItem.区分', starter: 'ThisItem.申請者', solution: 'ThisItem.部署 & "・" & ThisItem.区分' },
      { id: 'ap3c', title: '選択中の行を表示', app: 'expense', target: { control: 'Label1', prop: 'Text' },
        tests: [{ name: '1行目を選択', inputs: { Gallery1: 1 } }, { name: '4行目を選択', inputs: { Gallery1: 4 } }],
        prompt: 'Label1 に、ギャラリーで選択中の申請の「件名」を表示してください。（プレビューでギャラリーの行をタップすると変わります）',
        hint: 'Gallery1.Selected.件名', starter: '""', solution: 'Gallery1.Selected.件名' },
    ],
  },
  {
    id: 'ap4', title: 'Filter で絞り込む', goal: '条件・ドロップダウンの選択でギャラリーを絞り込む',
    body: `### Filter(テーブル, 条件)
\`\`\`powerfx
Filter(経費申請, ステータス = "承認待ち")
\`\`\`
- 条件の中では**列名をそのまま**書ける（ThisRecord.ステータス の省略）
- 複数条件：\`Filter(経費申請, 金額 >= 10000 && 区分 = "交通費")\`（\`,\` で並べても AND）
- または：\`||\` / \`Or\`

### ドロップダウンと連動させる
\`\`\`powerfx
Filter(経費申請,
    Dropdown1.Selected.Value = "すべて" || ステータス = Dropdown1.Selected.Value
)
\`\`\`
「すべて」が選ばれていれば条件が常に true になり、全件表示されます。

### 名前のぶつかりに注意
データソースの列名と同じ名前のコントロールや変数があると、どちらを指すかあいまいになります。\`ThisRecord.列名\` や \`[@列名]\` で明示できます。`,
    pc: `- ドロップダウンの Items に ["すべて","承認待ち",…] と書くと選択肢になる。データから作るなら Distinct(経費申請, ステータス)
- 数式バーの下に表示される「データ型の結果」で、Filter の結果の行数や中身を確認できる
- SharePoint の「選択肢」列は ステータス.Value のように .Value が必要なことがある（このアプリの演習ではテキスト列）`,
    quiz: [
      { q: 'Filter(経費申請, 金額 >= 10000, 区分 = "交通費") の意味は？', choices: ['金額1万以上 かつ 交通費', '金額1万以上 または 交通費', '交通費だけ', 'エラー'], a: 0, exp: 'Filter の複数の条件はすべて満たす（AND）行を返します。' },
      { q: 'Dropdown1 で選ばれた値を参照するのは？', choices: ['Dropdown1.Selected.Value', 'Dropdown1.Text', 'Dropdown1.Value', 'Dropdown1.Items'], a: 0, exp: '選択中のレコードが Selected、その値が .Value です。' },
    ],
    ex: [
      { id: 'ap4a', title: '承認待ちだけ表示', app: 'expense', target: { control: 'Gallery1', prop: 'Items' },
        prompt: 'Gallery1 に、ステータスが「承認待ち」の申請だけを表示してください。',
        hint: 'Filter(経費申請, ステータス = "承認待ち")', starter: '経費申請', solution: 'Filter(経費申請, ステータス = "承認待ち")' },
      { id: 'ap4b', title: '複数の条件', app: 'expense', target: { control: 'Gallery1', prop: 'Items' },
        prompt: '区分が「交通費」で、かつ金額が 5000 円以上の申請だけを表示してください。',
        hint: '&& でつなぐか、条件を , で並べる', starter: '経費申請', solution: 'Filter(経費申請, 区分 = "交通費" && 金額 >= 5000)' },
      { id: 'ap4c', title: 'ドロップダウンで絞り込み', app: 'expense', target: { control: 'Gallery1', prop: 'Items' },
        tests: [{ name: '「すべて」', inputs: { Dropdown1: 'すべて' } }, { name: '「承認待ち」', inputs: { Dropdown1: '承認待ち' } }, { name: '「差し戻し」', inputs: { Dropdown1: '差し戻し' } }],
        prompt: 'Dropdown1 で選んだステータスの申請だけを表示してください。「すべて」のときは全件を表示します。',
        hint: 'Dropdown1.Selected.Value = "すべて" || ステータス = Dropdown1.Selected.Value', starter: '経費申請', solution: 'Filter(経費申請, Dropdown1.Selected.Value = "すべて" || ステータス = Dropdown1.Selected.Value)' },
    ],
  },
  {
    id: 'ap5', title: '検索ボックス：Search と StartsWith', goal: '入力した文字で一覧を検索する（委任を意識した書き方も）',
    body: `### Search(テーブル, 検索文字, "列1", "列2", …)
\`\`\`powerfx
Search(経費申請, TextInput1.Text, "件名", "申請者")
\`\`\`
- 指定した列のどれかに検索文字を**含む**行を返す（大文字小文字は区別しない）
- 検索文字が空なら全件
- 列名は **" " で囲む**のがポイント

### StartsWith で「前方一致」
\`\`\`powerfx
Filter(経費申請, StartsWith(件名, TextInput1.Text))
\`\`\`
件名が入力した文字で**始まる**行。SharePoint リストでは Search や in（部分一致）は**委任できない**ため、件数が多いリストでは StartsWith が推奨されます（委任は第12回で詳しく）。

### 絞り込みを組み合わせる
\`\`\`powerfx
Search(
    Filter(経費申請, Dropdown1.Selected.Value = "すべて" || ステータス = Dropdown1.Selected.Value),
    TextInput1.Text, "件名", "申請者"
)
\`\`\``,
    pc: `- テキスト入力の **HintText** に「件名・申請者で検索」と書くと、空のときに薄く表示される
- 入力のたびに検索が走って重いときは、テキスト入力の **DelayOutput** を true にすると入力が止まってから反映される
- 検索アイコンを置くなら **挿入** → **アイコン** → 検索`,
    quiz: [
      { q: 'Search(経費申請, "田中", "申請者") で "田中 誠" の行は？', choices: ['含まれる（部分一致）', '含まれない（完全一致が必要）', 'エラー', '大文字小文字の違いで除外'], a: 0, exp: 'Search は指定した列に文字を含む行を返します。' },
      { q: 'SharePoint の大きなリストで検索するとき推奨される書き方は？', choices: ['Filter(リスト, StartsWith(列, 文字))', 'Search(リスト, 文字, "列")', 'Filter(リスト, 文字 in 列)', 'LookUp(リスト, 列 = 文字)'], a: 0, exp: 'StartsWith は SharePoint で委任できるので、2000件を超えても正しく検索できます。' },
    ],
    ex: [
      { id: 'ap5a', title: '件名・申請者で検索', app: 'expense', target: { control: 'Gallery1', prop: 'Items' },
        tests: [{ name: '空のとき', inputs: { TextInput1: '' } }, { name: '「田中」', inputs: { TextInput1: '田中' } }, { name: '「出張」', inputs: { TextInput1: '出張' } }],
        prompt: 'TextInput1 に入力した文字を「件名」または「申請者」に含む申請を表示してください（Search 関数）。',
        hint: 'Search(経費申請, TextInput1.Text, "件名", "申請者")', starter: '経費申請', solution: 'Search(経費申請, TextInput1.Text, "件名", "申請者")' },
      { id: 'ap5b', title: '前方一致（委任できる書き方）', app: 'expense', target: { control: 'Gallery1', prop: 'Items' },
        tests: [{ name: '空のとき', inputs: { TextInput1: '' } }, { name: '「タクシー」', inputs: { TextInput1: 'タクシー' } }, { name: '「大阪」', inputs: { TextInput1: '大阪' } }],
        prompt: '件名が TextInput1 の文字で始まる申請だけを表示してください（Filter と StartsWith）。',
        hint: 'Filter(経費申請, StartsWith(件名, TextInput1.Text))', starter: '経費申請', solution: 'Filter(経費申請, StartsWith(件名, TextInput1.Text))' },
      { id: 'ap5c', title: '検索 ＋ ドロップダウン', app: 'expense', target: { control: 'Gallery1', prop: 'Items' },
        tests: [{ name: 'すべて・空', inputs: { Dropdown1: 'すべて', TextInput1: '' } }, { name: '承認待ち・「出張」', inputs: { Dropdown1: '承認待ち', TextInput1: '出張' } }, { name: '承認済み・「山本」', inputs: { Dropdown1: '承認済み', TextInput1: '山本' } }],
        prompt: 'Dropdown1 のステータスで絞り込み（「すべて」なら全件）、さらに TextInput1 の文字で「件名」「申請者」を検索した結果を表示してください。',
        hint: 'Search(Filter(…), TextInput1.Text, "件名", "申請者")', starter: '経費申請', solution: 'Search(Filter(経費申請, Dropdown1.Selected.Value = "すべて" || ステータス = Dropdown1.Selected.Value), TextInput1.Text, "件名", "申請者")' },
    ],
  },
  {
    id: 'ap6', title: '並べ替え：Sort と SortByColumns', goal: '一覧の並び順を指定・切り替える',
    body: `### Sort(テーブル, 並べ替える式, 順序)
\`\`\`powerfx
Sort(経費申請, 金額, SortOrder.Descending)
\`\`\`
- 順序を省略すると昇順（SortOrder.Ascending）
- 式で並べ替えられる：\`Sort(経費申請, Len(件名))\`

### SortByColumns(テーブル, "列名", 順序, …)
\`\`\`powerfx
SortByColumns(経費申請, "申請日", SortOrder.Descending)
\`\`\`
列名を " " で囲んで指定。複数の列で並べ替えるときに便利（委任もしやすい）。

### トグルで切り替える
\`\`\`powerfx
Sort(経費申請, 金額, If(Toggle1.Value, SortOrder.Descending, SortOrder.Ascending))
\`\`\`

### 絞り込みと組み合わせる
Filter や Search の結果をそのまま Sort の1つ目に渡します（外側が Sort）。`,
    pc: `- 並べ替えボタン（↑↓のアイコン）を置き、OnSelect で UpdateContext({降順: !降順}) と変数を切り替え、Items で If(降順, …) とするのが定番
- 列見出しをタップして並べ替える表を作るなら「データ テーブル」コントロールもある`,
    quiz: [
      { q: 'Sort(経費申請, 金額) の並び順は？', choices: ['金額の小さい順', '金額の大きい順', '登録順', 'ランダム'], a: 0, exp: '順序を省略すると昇順（小さい順）です。' },
      { q: 'SortByColumns の列名の書き方は？', choices: ['"申請日" のように " " で囲む', '申請日 とそのまま書く', '[申請日]', 'ThisItem.申請日'], a: 0, exp: 'SortByColumns は列名を文字列で指定します。' },
    ],
    ex: [
      { id: 'ap6a', title: '金額の大きい順', app: 'expense', target: { control: 'Gallery1', prop: 'Items' },
        prompt: '経費申請を金額の大きい順に並べて表示してください。',
        hint: 'Sort(経費申請, 金額, SortOrder.Descending)', starter: '経費申請', solution: 'Sort(経費申請, 金額, SortOrder.Descending)' },
      { id: 'ap6b', title: '新しい順（列名で）', app: 'expense', target: { control: 'Gallery1', prop: 'Items' },
        prompt: 'SortByColumns を使って、申請日の新しい順（降順）に並べてください。',
        hint: 'SortByColumns(経費申請, "申請日", SortOrder.Descending)', starter: '経費申請', solution: 'SortByColumns(経費申請, "申請日", SortOrder.Descending)' },
      { id: 'ap6c', title: 'トグルで順序を切り替え', app: 'expense', target: { control: 'Gallery1', prop: 'Items' },
        tests: [{ name: 'トグル オフ', inputs: { Toggle1: false } }, { name: 'トグル オン', inputs: { Toggle1: true } }],
        prompt: 'Toggle1 がオン（true）なら金額の大きい順、オフなら小さい順に並べてください。',
        hint: 'Sort(経費申請, 金額, If(Toggle1.Value, SortOrder.Descending, SortOrder.Ascending))', starter: '経費申請', solution: 'Sort(経費申請, 金額, If(Toggle1.Value, SortOrder.Descending, SortOrder.Ascending))' },
    ],
  },
  {
    id: 'ap7', title: 'LookUp と集計（CountRows・Sum）', goal: '1件の取得と、件数・合計の表示',
    body: `### LookUp(テーブル, 条件, 取り出す列)
条件に合う**最初の1件**を返します（Excel の VLOOKUP / XLOOKUP）。
\`\`\`powerfx
LookUp(社員, 氏名 = Gallery1.Selected.申請者, 内線)
LookUp(社員, 氏名 = Gallery1.Selected.申請者).部署     // レコードを取ってから列
\`\`\`
見つからなければ空白（Blank）。

### 集計
| 関数 | 例 |
|---|---|
| CountRows(テーブル) | CountRows(Gallery1.AllItems) → 表示中の件数 |
| CountIf(テーブル, 条件) | CountIf(経費申請, ステータス = "承認待ち") |
| Sum(テーブル, 列) | Sum(経費申請, 金額) |
| Average / Max / Min | Max(経費申請, 金額) |
\`Gallery1.AllItems\` はギャラリーに表示されている行（絞り込み後）のテーブル。絞り込みに連動した件数・合計を出すのに便利です。
> CountRows・Sum などは SharePoint では委任できず、件数が多いと正しくない値になることがあります（第12回）。`,
    pc: `- 件数を見出しに出す：ラベルの Text に "承認待ち（" & CountRows(…) & "件）"
- 数値の書式は Text(Sum(…), "¥#,##0")
- ユーザー情報は User().FullName / User().Email。Office 365 ユーザー コネクタを追加すると上司や部署も取得できる`,
    quiz: [
      { q: 'LookUp で条件に合う行が複数あると？', choices: ['最初の1件を返す', 'すべて返す', 'エラー', '最後の1件を返す'], a: 0, exp: 'LookUp は最初に見つかった1件だけ。複数欲しいなら Filter。' },
      { q: '絞り込み後のギャラリーの件数を表示するには？', choices: ['CountRows(Gallery1.AllItems)', 'CountRows(経費申請)', 'Gallery1.Count', 'Count(Gallery1)'], a: 0, exp: 'AllItems は表示中の行のテーブルです。' },
    ],
    ex: [
      { id: 'ap7a', title: '承認待ちの件数', app: 'expense', target: { control: 'Label1', prop: 'Text' },
        prompt: 'Label1 に「承認待ち 4 件」のように、ステータスが承認待ちの申請の件数を表示してください（CountIf を使う）。',
        hint: '"承認待ち " & CountIf(経費申請, ステータス = "承認待ち") & " 件"', starter: '""', solution: '"承認待ち " & CountIf(経費申請, ステータス = "承認待ち") & " 件"' },
      { id: 'ap7b', title: '表示中の合計金額', app: 'expense', target: { control: 'Label1', prop: 'Text' },
        set: { 'Gallery1.Items': 'Filter(経費申請, Dropdown1.Selected.Value = "すべて" || ステータス = Dropdown1.Selected.Value)' },
        tests: [{ name: '「すべて」', inputs: { Dropdown1: 'すべて' } }, { name: '「承認待ち」', inputs: { Dropdown1: '承認待ち' } }],
        prompt: 'Gallery1 はドロップダウンで絞り込まれています。Label1 に、ギャラリーに表示中の申請の金額合計を「合計 ¥12,345」の形で表示してください。',
        hint: '"合計 " & Text(Sum(Gallery1.AllItems, 金額), "¥#,##0")', starter: '""', solution: '"合計 " & Text(Sum(Gallery1.AllItems, 金額), "¥#,##0")' },
      { id: 'ap7c', title: '申請者の内線番号', app: 'expense', target: { control: 'Label1', prop: 'Text' },
        tests: [{ name: '1行目（田中）', inputs: { Gallery1: 1 } }, { name: '4行目（小林）', inputs: { Gallery1: 4 } }],
        prompt: 'Label1 に、ギャラリーで選択中の申請者の内線番号を「内線 101」の形で表示してください。内線は「社員」データソースにあります（氏名で検索）。',
        hint: '"内線 " & LookUp(社員, 氏名 = Gallery1.Selected.申請者, 内線)', starter: '""', solution: '"内線 " & LookUp(社員, 氏名 = Gallery1.Selected.申請者, 内線)' },
    ],
  },
  {
    id: 'ap8', title: 'If・Switch と表示の切り替え', goal: '条件で色・表示/非表示・操作可否を変える',
    body: `### If と Switch
\`\`\`powerfx
If(ThisItem.金額 >= 10000, Color.Red, Color.Black)

Switch(ThisItem.ステータス,
    "承認済み", Color.Green,
    "差し戻し", Color.Red,
    Color.Orange            // どれにも当てはまらないとき
)
\`\`\`
- If は条件と結果を何組でも並べられる：\`If(条件1, 結果1, 条件2, 結果2, その他)\`
- Switch は1つの値をいくつかの値と比べるときに読みやすい

### 色・表示・操作可否のプロパティ
| プロパティ | 値 |
|---|---|
| Color / Fill | Color.Red、RGBA(255, 0, 0, 1)、ColorValue("#FF0000") |
| Visible | true / false（false で非表示） |
| DisplayMode | DisplayMode.Edit（操作可）/ DisplayMode.Disabled（灰色で押せない）/ DisplayMode.View |

### 未入力チェック
\`\`\`powerfx
If(IsBlank(txt件名.Text), DisplayMode.Disabled, DisplayMode.Edit)
\`\`\`
入力が揃うまで送信ボタンを押せないようにするのは、業務アプリの基本です。`,
    pc: `- プロパティ ペインの色を選ぶと数式に RGBA(…) が入る。条件で変えたいときは数式バーで If に書き換える
- 1か所で色を管理するなら、App の OnStart や名前付き数式（App.Formulas）でテーマ色を定義する
- ボタンの DisplayMode が Disabled のときの色は DisabledFill / DisabledColor で設定`,
    quiz: [
      { q: 'ボタンを灰色にして押せなくするプロパティと値は？', choices: ['DisplayMode = DisplayMode.Disabled', 'Visible = false', 'Fill = Color.Gray', 'OnSelect = false'], a: 0, exp: 'DisplayMode.Disabled で押せなくなります。Visible = false は非表示。' },
      { q: 'Switch の最後の引数（対になっていない1つ）は？', choices: ['どれにも当てはまらないときの結果', '比較する値', 'エラー時の値', '不要'], a: 0, exp: '最後の1つは「その他」の結果です。' },
    ],
    ex: [
      { id: 'ap8a', title: 'ステータスで色分け', app: 'expense', target: { control: 'Status1', prop: 'Color' },
        prompt: 'ギャラリーの Status1 の文字色を、承認済みなら Color.Green、差し戻しなら Color.Red、それ以外は Color.Orange にしてください（Switch）。',
        hint: 'Switch(ThisItem.ステータス, "承認済み", Color.Green, "差し戻し", Color.Red, Color.Orange)', starter: 'Color.Gray', solution: 'Switch(ThisItem.ステータス, "承認済み", Color.Green, "差し戻し", Color.Red, Color.Orange)' },
      { id: 'ap8b', title: '承認待ちのときだけボタンを表示', app: 'expense', target: { control: 'Button1', prop: 'Visible' },
        tests: [{ name: '1行目（承認待ち）', inputs: { Gallery1: 1 } }, { name: '2行目（承認済み）', inputs: { Gallery1: 2 } }],
        prompt: 'Button1（承認する）を、ギャラリーで選択中の申請が「承認待ち」のときだけ表示してください。',
        hint: 'Visible に条件式を書く：Gallery1.Selected.ステータス = "承認待ち"', starter: 'true', solution: 'Gallery1.Selected.ステータス = "承認待ち"' },
      { id: 'ap8c', title: '未入力なら送信不可', app: 'expense', screen: '申請画面', target: { control: 'btn送信', prop: 'DisplayMode' },
        tests: [{ name: '両方空', inputs: { txt件名: '', txt金額: '' } }, { name: '件名だけ', inputs: { txt件名: '文房具', txt金額: '' } }, { name: '両方入力', inputs: { txt件名: '文房具', txt金額: '800' } }],
        prompt: 'btn送信 を、txt件名 と txt金額 の両方が入力されたときだけ押せるように（どちらかが空なら DisplayMode.Disabled、そうでなければ DisplayMode.Edit）してください。',
        hint: 'If(IsBlank(txt件名.Text) || IsBlank(txt金額.Text), DisplayMode.Disabled, DisplayMode.Edit)', starter: 'DisplayMode.Edit', solution: 'If(IsBlank(txt件名.Text) || IsBlank(txt金額.Text), DisplayMode.Disabled, DisplayMode.Edit)' },
    ],
  },
  {
    id: 'ap9', title: '変数とコレクション', goal: 'Set・UpdateContext・Collect / ClearCollect の使い分け',
    body: `### 3種類の「覚えておく場所」
| 種類 | 作り方 | 範囲 |
|---|---|---|
| グローバル変数 | \`Set(変数名, 値)\` | アプリ全体 |
| コンテキスト変数 | \`UpdateContext({変数名: 値})\` | その画面だけ |
| コレクション | \`Collect(コレクション名, レコード)\` | アプリ全体のテーブル |
変数はボタンの OnSelect などの**動作の式**で値を入れ、ラベルなどのプロパティで参照します。

### コレクション
\`\`\`powerfx
Collect(カート, {商品名: galProducts.Selected.商品名, 数量: 1})   // 1行追加
ClearCollect(承認待ち一覧, Filter(経費申請, ステータス = "承認待ち")) // 中身を入れ替え
Clear(カート)                                                       // 空にする
\`\`\`
- 一時的なリスト（カート、入力途中の明細）や、データソースのコピー（オフライン・高速化）に使う
- App の **OnStart** に ClearCollect を書いて、起動時にマスタを読み込むのが定番

### 動作をつなぐ
\`;\` で区切ると順に実行されます。
\`\`\`powerfx
Collect(カート, {…}); Notify("カートに追加しました", NotificationType.Success)
\`\`\``,
    pc: `- 変数の中身の確認：左の **変数**（{x} アイコン）→ グローバル／コンテキスト／コレクション
- App の OnStart を試すには、ツリービューで App を右クリック → **OnStart を実行**
- 最近は App.Formulas（名前付き数式）で「計算結果に名前を付ける」書き方も推奨されている`,
    quiz: [
      { q: '画面をまたいで使いたい値を保存するのは？', choices: ['Set（グローバル変数）', 'UpdateContext', 'ThisItem', 'Reset'], a: 0, exp: 'UpdateContext はその画面だけ。アプリ全体なら Set です。' },
      { q: 'コレクションの中身を入れ替える関数は？', choices: ['ClearCollect', 'Collect', 'Patch', 'Set'], a: 0, exp: 'ClearCollect は中身を消してから追加します。Collect は追加だけ。' },
    ],
    ex: [
      { id: 'ap9a', title: '選んだ件名を変数に保存', app: 'expense', target: { control: 'Button1', prop: 'OnSelect' },
        tests: [{ name: '2行目を選んで押す', inputs: { Gallery1: 2 } }, { name: '6行目を選んで押す', inputs: { Gallery1: 6 } }],
        prompt: 'Button1 を押したら、ギャラリーで選択中の申請の件名をグローバル変数「選択件名」に保存してください。',
        hint: 'Set(選択件名, Gallery1.Selected.件名)', starter: '', solution: 'Set(選択件名, Gallery1.Selected.件名)' },
      { id: 'ap9b', title: 'カートに追加', app: 'catalog', target: { control: 'btn追加', prop: 'OnSelect' }, clicks: 2,
        tests: [{ name: '1番目の商品で2回押す', inputs: { galProducts: 1 } }, { name: '6番目の商品で2回押す', inputs: { galProducts: 6 } }],
        prompt: 'btn追加 を押すたびに、コレクション「カート」に {商品名: 選択中の商品名, 単価: 選択中の単価, 数量: 1} のレコードを1行追加してください。（採点では2回押します）',
        hint: 'Collect(カート, {商品名: galProducts.Selected.商品名, 単価: galProducts.Selected.単価, 数量: 1})', starter: '', solution: 'Collect(カート, {商品名: galProducts.Selected.商品名, 単価: galProducts.Selected.単価, 数量: 1})' },
      { id: 'ap9c', title: '承認待ちをコレクションに', app: 'expense', target: { control: 'Button1', prop: 'OnSelect' }, clicks: 2,
        prompt: 'Button1 を押したら、ステータスが「承認待ち」の申請をコレクション「承認待ち一覧」に読み込んでください。何回押しても重複しないようにします（採点では2回押します）。',
        hint: 'ClearCollect(承認待ち一覧, Filter(経費申請, ステータス = "承認待ち"))', starter: '', solution: 'ClearCollect(承認待ち一覧, Filter(経費申請, ステータス = "承認待ち"))' },
      { id: 'ap9d', title: 'カートの合計', app: 'catalog', target: { control: 'lbl合計', prop: 'Text' },
        set: { 'btn追加.OnSelect': 'Collect(カート, {商品名: galProducts.Selected.商品名, 単価: galProducts.Selected.単価, 数量: 1})' },
        tests: [{ name: 'カートが空', inputs: {} }, { name: 'コーヒー豆とマグカップを追加', before: [{ inputs: { galProducts: 1 }, press: 'btn追加' }, { inputs: { galProducts: 8 }, press: 'btn追加' }], inputs: {} }],
        prompt: 'lbl合計 に、コレクション「カート」の（単価 × 数量）の合計を「カート合計 ¥3,000」の形で表示してください。（プレビューで「カートに追加」を押して確かめられます）',
        hint: 'Sum(テーブル, 式) の式に 単価 * 数量', starter: '""', solution: '"カート合計 " & Text(Sum(カート, 単価 * 数量), "¥#,##0")' },
    ],
  },
  {
    id: 'ap10', title: 'データの保存：Patch と Remove', goal: 'データソースのレコードを追加・更新・削除する',
    body: `### Patch(データソース, レコード, 変更内容)
**更新**：既存のレコードを指定して、変える列だけ書きます。
\`\`\`powerfx
Patch(経費申請, Gallery1.Selected, {ステータス: "承認済み"})
\`\`\`
**追加**：Defaults(データソース) を指定すると新しいレコードになります。
\`\`\`powerfx
Patch(経費申請, Defaults(経費申請), {
    件名: txt件名.Text,
    金額: Value(txt金額.Text),
    区分: drp区分.Selected.Value,
    ステータス: "承認待ち"
})
\`\`\`
- 数値の列には Value() で数値にして渡す（型が違うとエラー）
- SharePoint の「選択肢」列は {Value: "承認済み"}、「ユーザー」列は特別なレコードが必要（実務で要注意）

### Remove / RemoveIf
\`\`\`powerfx
Remove(経費申請, Gallery1.Selected)
RemoveIf(経費申請, ステータス = "差し戻し")
\`\`\`

### フォームを使う方法もある
**編集フォーム**コントロールを置けば、SubmitForm(Form1) で入力欄の内容をまとめて保存できます（項目が多いときに便利）。Patch は自由度が高く、ボタン1つで状態を変える処理に向いています。`,
    pc: `- 保存後にメッセージ：Patch(…); Notify("保存しました", NotificationType.Success)
- エラー処理：IfError(Patch(…), Notify("保存に失敗しました", NotificationType.Error))
- 入力欄のリセット：Reset(txt件名)
- フォーム：**挿入** → **編集フォーム** → DataSource と Item を設定、ボタンの OnSelect に SubmitForm(Form1)`,
    quiz: [
      { q: '新しいレコードを追加する Patch の2つ目の引数は？', choices: ['Defaults(データソース)', 'Gallery1.Selected', 'Blank()', 'New()'], a: 0, exp: 'Defaults で新規レコードのひな形を渡します。既存のレコードを渡すと更新。' },
      { q: 'テキスト入力の金額を数値の列に保存するとき必要なのは？', choices: ['Value(txt金額.Text)', 'Text(txt金額.Text)', 'txt金額.Text をそのまま', 'Number(txt金額)'], a: 0, exp: '入力はテキストなので Value で数値に変換します。' },
    ],
    ex: [
      { id: 'ap10a', title: '承認する（更新）', app: 'expense', target: { control: 'Button1', prop: 'OnSelect' },
        tests: [{ name: '1行目を承認', inputs: { Gallery1: 1 } }, { name: '4行目を承認', inputs: { Gallery1: 4 } }],
        prompt: 'Button1 を押したら、ギャラリーで選択中の申請のステータスを「承認済み」に更新してください（Patch）。',
        hint: 'Patch(経費申請, Gallery1.Selected, {ステータス: "承認済み"})', starter: '', solution: 'Patch(経費申請, Gallery1.Selected, {ステータス: "承認済み"})' },
      { id: 'ap10b', title: '新しい申請を追加', app: 'expense', screen: '申請画面', target: { control: 'btn送信', prop: 'OnSelect' },
        tests: [{ name: '文房具 800円 消耗品費', inputs: { txt件名: '文房具', txt金額: '800', drp区分: '消耗品費' } }, { name: '書籍 2400円', inputs: { txt件名: 'Excel の本', txt金額: '2400', drp区分: '書籍代' } }],
        prompt: 'btn送信 を押したら、経費申請に新しいレコードを追加してください。件名＝txt件名、金額＝txt金額（数値に変換）、区分＝drp区分 の選択値、ステータス＝"承認待ち"、申請者＝User().FullName。',
        hint: 'Patch(経費申請, Defaults(経費申請), {件名: txt件名.Text, 金額: Value(txt金額.Text), 区分: drp区分.Selected.Value, ステータス: "承認待ち", 申請者: User().FullName})',
        starter: '', solution: 'Patch(経費申請, Defaults(経費申請), {件名: txt件名.Text, 金額: Value(txt金額.Text), 区分: drp区分.Selected.Value, ステータス: "承認待ち", 申請者: User().FullName})' },
      { id: 'ap10c', title: '差し戻しを一括削除', app: 'expense', target: { control: 'Button1', prop: 'OnSelect' },
        prompt: 'Button1 を押したら、ステータスが「差し戻し」の申請をすべて削除し、「削除しました」と通知（Notify）してください。',
        hint: 'RemoveIf(経費申請, ステータス = "差し戻し"); Notify("削除しました")', starter: '', solution: 'RemoveIf(経費申請, ステータス = "差し戻し"); Notify("削除しました")' },
    ],
  },
  {
    id: 'ap11', title: '画面遷移：Navigate と Back', goal: '一覧 → 詳細 → 戻る の画面の流れを作る',
    body: `### Navigate(画面名, 切り替え効果, {コンテキスト変数})
\`\`\`powerfx
Navigate(詳細画面, ScreenTransition.Fade)
\`\`\`
- ギャラリーの **OnSelect** に書くと、行をタップしたときに移動（そのとき Gallery1.Selected はタップした行）
- 3つ目に \`{選択ID: ThisItem.ID}\` を渡すと、移動先の画面のコンテキスト変数になる
- 戻るボタン：\`Back()\`

### 詳細画面の作り方
詳細画面のラベルで \`Gallery1.Selected.件名\` のように、一覧画面のギャラリーの選択行を参照します（コントロールは画面をまたいで参照できる）。

### 一覧・詳細・編集の3画面
SharePoint から「データから作成」すると、BrowseScreen（一覧）・DetailScreen（詳細）・EditScreen（編集）の3画面が自動生成されます。中の数式を読むと、Navigate・SubmitForm・Remove の使い方の良い教材になります。`,
    pc: `- 画面の追加：**挿入** → **新しい画面** → 空 / スクロール可能 / 一覧 など
- 画面の OnVisible：その画面が表示されたときの動作（変数の初期化など）
- アプリの開始画面：App の StartScreen プロパティ
- 画面名はツリービューで変更（詳細画面、編集画面 のように日本語でも可）`,
    quiz: [
      { q: 'ギャラリーの行をタップして詳細画面に移動するには、どこに Navigate を書く？', choices: ['ギャラリーの OnSelect', 'ギャラリーの Items', '詳細画面の Visible', 'ラベルの Text'], a: 0, exp: 'タップしたときの動作なので OnSelect に書きます。' },
      { q: '前の画面に戻る関数は？', choices: ['Back()', 'Return()', 'Navigate()', 'Exit()'], a: 0, exp: 'Back で直前の画面に戻ります。' },
    ],
    ex: [
      { id: 'ap11a', title: 'タップで詳細画面へ', app: 'expense', target: { control: 'Gallery1', prop: 'OnSelect' },
        prompt: 'ギャラリーの行をタップしたら「詳細画面」に、フェード（ScreenTransition.Fade）で移動するようにしてください。',
        hint: 'Navigate(詳細画面, ScreenTransition.Fade)', starter: '', solution: 'Navigate(詳細画面, ScreenTransition.Fade)' },
      { id: 'ap11b', title: '詳細画面に日付を表示', app: 'expense', screen: '詳細画面', target: { control: '詳細日付', prop: 'Text' },
        tests: [{ name: '1行目', inputs: { Gallery1: 1 } }, { name: '9行目', inputs: { Gallery1: 9 } }],
        prompt: '詳細画面の「詳細日付」に、一覧で選んだ申請の申請日を「申請日: 2026年5月7日」の形で表示してください。',
        hint: '"申請日: " & Text(Gallery1.Selected.申請日, "yyyy年m月d日")', starter: '""', solution: '"申請日: " & Text(Gallery1.Selected.申請日, "yyyy年m月d日")' },
      { id: 'ap11c', title: '保存して一覧へ戻る', app: 'expense', screen: '申請画面', target: { control: 'btn送信', prop: 'OnSelect' },
        tests: [{ name: '入力して送信', inputs: { txt件名: '駐車場代', txt金額: '1500', drp区分: '交通費' } }],
        prompt: 'btn送信 を押したら、①経費申請に新しいレコードを追加（件名・金額・区分・ステータス "承認待ち"）し、②「申請しました」と成功の通知（NotificationType.Success）を出し、③一覧画面に移動してください。',
        hint: 'Patch(…); Notify("申請しました", NotificationType.Success); Navigate(一覧画面)',
        starter: '', solution: 'Patch(経費申請, Defaults(経費申請), {件名: txt件名.Text, 金額: Value(txt金額.Text), 区分: drp区分.Selected.Value, ステータス: "承認待ち"}); Notify("申請しました", NotificationType.Success); Navigate(一覧画面)' },
    ],
  },
  {
    id: 'ap12', title: '日付の扱い', goal: 'Today・DateAdd・DateDiff・Text で日付を計算・表示する',
    body: `### 日付の関数
| 関数 | 例 | 結果 |
|---|---|---|
| Today() | Today() | 今日の日付 |
| Date(年, 月, 日) | Date(2026, 4, 1) | 2026/4/1 |
| DateAdd(日付, 数, 単位) | DateAdd(Today(), 7, TimeUnit.Days) | 7日後 |
| DateDiff(開始, 終了, 単位) | DateDiff(申請日, Today()) | 経過日数 |
| Year / Month / Day | Month(申請日) | 月の数値 |
| Text(日付, 書式) | Text(申請日, "yyyy/mm/dd") | "2026/05/07" |
> 書式の **mm は月**（Power Fx では hh:mm のときだけ分）。曜日は "ddd"（日本語環境で「木」）。

### 期限・経過日数の例
\`\`\`powerfx
// 申請から何日たったか
DateDiff(ThisItem.申請日, Today()) & " 日経過"
// 今月の申請だけ
Filter(経費申請, Month(申請日) = Month(Today()) && Year(申請日) = Year(Today()))
\`\`\`
> 演習では「今日」を 2026年6月15日 に固定しています。`,
    pc: `- 日付の選択：**挿入** → **入力** → **日付の選択**（DatePicker1.SelectedDate で参照）
- タイムゾーンに注意：SharePoint の日付列は UTC で保存される。「日付のみ」の列にするとずれにくい
- 日付のフィルターは委任できる演算（>=、<=）を使うと大量データでも安全`,
    quiz: [
      { q: 'DateAdd(Date(2026,1,31), 1, TimeUnit.Months) の結果は？', choices: ['2026/2/28', '2026/3/3', '2026/2/31', 'エラー'], a: 0, exp: '月末を超える日は、その月の最終日になります。' },
      { q: 'Text(Date(2026,5,7), "yyyy/mm/dd") の結果は？', choices: ['"2026/05/07"', '"2026/5/7"', '"2026/07/05"', '"2026/00/07"'], a: 0, exp: 'mm は2桁の月、dd は2桁の日です。' },
    ],
    ex: [
      { id: 'ap12a', title: '経過日数', app: 'expense', target: { control: 'Status1', prop: 'Text' },
        prompt: 'ギャラリーの Status1 を「承認待ち（39日経過）」のように、ステータスと申請日から今日（Today()）までの経過日数を表示する式にしてください。カッコは全角です。',
        hint: 'ThisItem.ステータス & "（" & DateDiff(ThisItem.申請日, Today()) & "日経過）"', starter: 'ThisItem.ステータス', solution: 'ThisItem.ステータス & "（" & DateDiff(ThisItem.申請日, Today()) & "日経過）"' },
      { id: 'ap12b', title: '5月の申請だけ', app: 'expense', target: { control: 'Gallery1', prop: 'Items' },
        prompt: '申請日が5月の申請だけを表示してください（年は2026年だけのデータです）。',
        hint: 'Filter(経費申請, Month(申請日) = 5)', starter: '経費申請', solution: 'Filter(経費申請, Month(申請日) = 5)' },
      { id: 'ap12c', title: '支払予定日', app: 'expense', target: { control: 'Label1', prop: 'Text' },
        tests: [{ name: '1行目', inputs: { Gallery1: 1 } }, { name: '8行目', inputs: { Gallery1: 8 } }],
        prompt: 'Label1 に、選択中の申請の申請日の30日後を支払予定日として「支払予定: 2026/06/06」の形で表示してください。',
        hint: '"支払予定: " & Text(DateAdd(Gallery1.Selected.申請日, 30, TimeUnit.Days), "yyyy/mm/dd")', starter: '""', solution: '"支払予定: " & Text(DateAdd(Gallery1.Selected.申請日, 30, TimeUnit.Days), "yyyy/mm/dd")' },
    ],
  },
  {
    id: 'ap13', title: '委任・パフォーマンス・共有の実務', goal: '大量データでの落とし穴（委任）と、公開・共有・Power Automate 連携を知る',
    body: `### 委任（Delegation）とは
Filter などの処理を**データソース側（SharePoint・Dataverse）で実行**させること。委任できない書き方をすると、Power Apps は先頭の **500件（設定で最大2000件）だけ**を取ってきて処理します。→ **2001件目以降が検索にヒットしない**という気づきにくいバグになります。

| SharePoint で委任できる | 委任できない（例） |
|---|---|
| =、<>、<、>、<=、>=、And、Or | Search、in（部分一致） |
| StartsWith | Len、Left、Mid、Year、Month などの関数を条件に使う |
| Sort / SortByColumns（単純な列） | CountRows・Sum などの集計（条件付き） |
数式に **黄色の三角（⚠）と青い二重下線** が出たら委任の警告です。このアプリでも、SharePoint の「経費申請」に委任できない式を書くと警告を表示します。

### 対策
- StartsWith・比較演算子で書けるよう工夫する（例：月で絞るなら 申請日 >= Date(…) && 申請日 < Date(…)）
- 件数を絞ってからコレクションに入れる
- データ行の上限：**設定 → 全般 → データ行の制限**（最大 2000）。根本解決ではない
- 大量データ・複雑な処理は Dataverse や SQL を検討

### 公開と共有
- **保存 → 公開** で利用者に反映（公開するまでは古いバージョンが使われる）
- **共有**：ユーザー／グループを追加。データソース（SharePoint リスト）の権限も別に必要
- スマホでは Power Apps モバイル アプリ、PC ではブラウザや Teams から使える

### Power Automate との連携
メール送信・承認フロー・定期処理は Power Automate の得意分野。Power Apps のボタンから \`フロー名.Run(引数)\` でフローを呼び出せます。例：申請ボタン → 上司に承認依頼（Approvals）→ 結果で SharePoint を更新。`,
    pc: `- 委任の警告の確認：数式の青い二重下線にマウスを乗せる。**アプリ チェッカー**（聴診器のアイコン）でも一覧できる
- テスト用にデータ行の制限を 1 などにすると、委任されない式をすぐ見つけられる
- フローの追加：左の **Power Automate** アイコン → **フローの追加**（「Power Apps (V2)」トリガーのフロー）
- 環境・ソリューション：本番運用では「ソリューション」に入れて開発→本番へ移すのが推奨`,
    quiz: [
      { q: 'SharePoint の 5000 件のリストで Search を使うと？', choices: ['先頭の 500〜2000 件だけが検索対象になる', '5000件すべて検索される', 'エラーで止まる', '自動で StartsWith に変換される'], a: 0, exp: 'Search は SharePoint で委任できないため、取得済みの先頭の行だけで処理されます。' },
      { q: '委任の警告が出ているときの見た目は？', choices: ['黄色の ⚠ と青い二重下線', '赤い ✕', '緑のチェック', '何も表示されない'], a: 0, exp: '委任の警告は黄色の三角と青い二重下線です（赤は文法エラー）。' },
      { q: 'アプリを修正したのに利用者の画面が変わらない。原因は？', choices: ['保存しただけで「公開」していない', 'ブラウザが古い', 'SharePoint の権限がない', 'コレクションが空'], a: 0, exp: '保存だけではドラフト。公開すると利用者に反映されます。' },
      { q: 'アプリから承認メールを送り、上司の承認を待つ処理に向いているのは？', choices: ['Power Automate のフローを呼び出す', 'Patch を連続で書く', 'Timer コントロール', 'Navigate'], a: 0, exp: '承認・メール・定期実行は Power Automate が得意です。' },
    ],
    ex: [
      { id: 'ap13a', title: '委任できる書き方に直す', app: 'expense', target: { control: 'Gallery1', prop: 'Items' }, noDelegation: true,
        prompt: '「Filter(経費申請, Month(申請日) = 5)」は Month 関数のため SharePoint で委任できません。比較演算子だけで、申請日が 2026年5月1日以上 かつ 2026年6月1日より前 の申請を表示する式に書き換えてください（委任の警告が消えることを確認）。',
        hint: 'Filter(経費申請, 申請日 >= Date(2026, 5, 1) && 申請日 < Date(2026, 6, 1))', starter: 'Filter(経費申請, Month(申請日) = 5)', solution: 'Filter(経費申請, 申請日 >= Date(2026, 5, 1) && 申請日 < Date(2026, 6, 1))' },
    ],
  },
];
