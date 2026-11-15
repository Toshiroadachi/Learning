// Python 100日 カリキュラム（オリジナル教材）Day 1〜10：基礎
// lesson は簡易マークダウン（### 見出し / - 箇条書き / ```コード``` / > ヒント / 表）
// tests の check は Python コード。__out__ に出力全体、__lines__ に行のリストが入る。
export const DAYS_0 = [
{
  day: 1, title: 'print・input・変数',
  goal: '画面に表示し、キーボードから受け取り、変数に入れて使う',
  lesson: `### ようこそ Python へ
Python は読みやすく、Web・データ分析・AI・自動化と幅広く使われる言語です。このアプリでは**本物の Python がブラウザの中で動きます**。下の演習の ▶ 実行 で動かし、✓ 採点 で自動テストを受けましょう。

### print() で表示する
\`\`\`python
print("こんにちは")
print('シングルクォートでもOK')
print("1行目\\n2行目")   # \\n は改行
print("A" + "B")         # 文字列をつなぐ（連結）→ AB
print("ha" * 3)          # 繰り返し → hahaha
\`\`\`
- 文字列は \`"\` か \`'\` で囲む
- \`#\` から行末までは**コメント**（実行されないメモ）
- カッコやクォートは**半角**で書く（全角だとエラー）

### input() で受け取る
\`input()\` は入力された文字を**文字列**として返します。カッコ内の文字はプロンプト（案内）として表示されます。
\`\`\`python
name = input("名前は？ ")
print("ようこそ、" + name + "さん")
print(len(name))      # 文字数
\`\`\`
関数の中に関数を入れると、**内側から先に**実行されます：\`print(len(input("名前: ")))\`

### 変数
\`=\` は「右の値を左の名前に入れる（代入）」という意味。数学の「等しい」ではありません。
\`\`\`python
a = "りんご"
b = "みかん"
a, b = b, a      # 入れ替え
print(a, b)      # みかん りんご（カンマで区切ると間に空白）
\`\`\`
> 変数名は英数字と _ で、意味の分かる名前に（例: user_name）。数字から始めたり、\`print\` などの組み込みの名前を使ったりしないこと。

### よくあるエラー
| エラー | 原因の例 |
|---|---|
| SyntaxError | クォートやカッコの閉じ忘れ、全角文字 |
| NameError | 変数名のスペルミス、クォート忘れ（\`print(hello)\`） |
| IndentationError | 行頭に余計なスペース |`,
  exercises: [
    { id: 'd1-0', title: '自己紹介を3行で', prompt: '次の3行を、この通りに表示しよう（1つの print で \\n を使っても、print を3回使ってもOK）。\n```\nはじめまして\nPython を勉強中です\n100日がんばります！\n```',
      starter: '# ここに print を書こう\n',
      tests: [{ name: '3行', check: 'assert __lines__ == ["はじめまして", "Python を勉強中です", "100日がんばります！"], f"表示された行: {__lines__}"' }],
      hint: 'print("はじめまして") のように1行ずつ書くのが簡単です。文字はコピーして正確に。',
      solution: 'print("はじめまして")\nprint("Python を勉強中です")\nprint("100日がんばります！")\n' },
    { id: 'd1-2', title: '文字数カウンター', prompt: '名前を入力してもらい、`たろう さんの名前は 3 文字です` のように表示しよう。\n\n文字数は `len()` で数えられます。数値を文字列とつなぐには `str()` で文字列に変換します。',
      starter: 'name = input("名前は？ ")\n',
      tests: [
        { name: 'たろう', inputs: ['たろう'], check: 'assert "たろう さんの名前は 3 文字です" in __out__, "期待: たろう さんの名前は 3 文字です"' },
        { name: 'Alexander', inputs: ['Alexander'], check: 'assert "Alexander さんの名前は 9 文字です" in __out__, "len() で数えていますか？"' }],
      hint: 'print(name + " さんの名前は " + str(len(name)) + " 文字です")',
      solution: 'name = input("名前は？ ")\nprint(name + " さんの名前は " + str(len(name)) + " 文字です")\n' },
    { id: 'd1-3', title: '変数の入れ替え', prompt: '2つの値 a と b を入力し、**中身を入れ替えてから** `a: (aの値)` と `b: (bの値)` を表示しよう。\n\n`print("a: " + b)` のようにごまかさず、本当に変数を入れ替えること。',
      starter: 'a = input("a: ")\nb = input("b: ")\n# ここで a と b を入れ替えよう\n\nprint("a: " + a)\nprint("b: " + b)\n',
      tests: [
        { name: '入れ替え', inputs: ['3', '5'], check: 'assert __lines__[-2:] == ["a: 5", "b: 3"], f"最後の2行: {__lines__[-2:]}"\nassert a == "5" and b == "3", "変数 a, b の中身が入れ替わっていません"' }],
      hint: 'a, b = b, a の1行で入れ替えられます。（一時変数 c = a; a = b; b = c でもOK）',
      solution: 'a = input("a: ")\nb = input("b: ")\na, b = b, a\n\nprint("a: " + a)\nprint("b: " + b)\n' },
    { id: 'd1-1', title: 'ミニプロジェクト：チーム名ジェネレーター', prompt: '好きな色と好きな動物を input() で聞き、`チーム名は「(色)(動物)ズ」です` と表示しよう。\n\n例: 色「レッド」動物「タイガー」→ `チーム名は「レッドタイガーズ」です`',
      starter: 'print("チーム名ジェネレーターへようこそ！")\ncolor = input("好きな色は？ ")\n# 動物も聞こう\n\n# チーム名を表示しよう\n',
      tests: [
        { name: 'レッド＋タイガー', inputs: ['レッド', 'タイガー'], check: 'assert "チーム名は「レッドタイガーズ」です" in __out__, "表示が「チーム名は「レッドタイガーズ」です」になっていません"' },
        { name: 'ブルー＋シャーク', inputs: ['ブルー', 'シャーク'], check: 'assert "「ブルーシャークズ」" in __out__, "入力した値が使われていますか？"' }],
      hint: 'animal = input("好きな動物は？ ") で受け取り、"チーム名は「" + color + animal + "ズ」です" のように + でつなぎます。',
      solution: 'print("チーム名ジェネレーターへようこそ！")\ncolor = input("好きな色は？ ")\nanimal = input("好きな動物は？ ")\nprint("チーム名は「" + color + animal + "ズ」です")\n' },
  ],
},
{
  day: 2, title: 'データ型・計算・f文字列',
  goal: 'int / float / str / bool と型変換、算術演算子、f文字列で表示を整える',
  lesson: `### 主なデータ型
| 型 | 例 | 説明 |
|---|---|---|
| int | 42, -7 | 整数 |
| float | 3.14, 2.0 | 小数 |
| str | "abc", "123" | 文字列 |
| bool | True / False | 真偽値 |

\`type(x)\` で型を確認できます。文字列の一部は \`"Hello"[0]\`（→ H）のように番号で取り出せます（0から数える）。

### 型変換
\`int()\` \`float()\` \`str()\` で変換します。**input() の結果は常に文字列**なので、計算する前に変換が必要です。
\`\`\`python
age = input("年齢: ")        # "20"（文字列）
print(age + 1)               # TypeError!
print(int(age) + 1)          # 21
\`\`\`
### 算術演算子
| 演算子 | 意味 | 例 |
|---|---|---|
| + - * | 足す・引く・掛ける | 3 * 4 → 12 |
| / | 割る（結果は float） | 7 / 2 → 3.5 |
| // | 切り捨て除算 | 7 // 2 → 3 |
| % | 余り | 7 % 2 → 1 |
| ** | べき乗 | 2 ** 3 → 8 |

優先順位は数学と同じで、カッコが最優先。\`x += 1\` は \`x = x + 1\` の省略形です（\`-=\` \`*=\` \`/=\` も）。

### 丸めと f文字列
\`\`\`python
bmi = 60 / 1.7 ** 2
print(round(bmi, 1))            # 20.8
print(f"BMIは{bmi:.1f}です")      # f"..." の中の {} に式を書ける
print(f"{1234567:,}円")          # 1,234,567円（3桁区切り）
\`\`\`
> f文字列を使えば str() で変換しなくても数値を文字列に埋め込めます。今後はこれを主に使いましょう。`,
  exercises: [
    { id: 'd2-2', title: '2桁の数の各桁を足す', prompt: '2桁の数（例: `39`）を入力し、各桁の合計（3+9）を `合計: 12` と表示しよう。\n\n文字列の `[0]` `[1]` で各桁を取り出し、`int()` で数値に変換します。',
      starter: 'n = input("2桁の数: ")\n',
      tests: [
        { name: '39', inputs: ['39'], check: 'assert "合計: 12" in __out__, "3 + 9 = 12"' },
        { name: '70', inputs: ['70'], check: 'assert "合計: 7" in __out__, "7 + 0 = 7"' }],
      hint: 'total = int(n[0]) + int(n[1])、print(f"合計: {total}")',
      solution: 'n = input("2桁の数: ")\ntotal = int(n[0]) + int(n[1])\nprint(f"合計: {total}")\n' },
    { id: 'd2-3', title: 'BMI 計算', prompt: '身長（m）と体重（kg）を入力して BMI（体重 ÷ 身長の2乗）を計算し、`BMI: 22.0` のように小数第1位まで表示しよう。',
      starter: 'height = input("身長(m): ")\nweight = input("体重(kg): ")\n',
      tests: [
        { name: '1.7m/60kg', inputs: ['1.7', '60'], check: 'assert "BMI: 20.8" in __out__, "60 / 1.7**2 = 20.76… → 20.8"' },
        { name: '1.8m/71.28kg', inputs: ['1.8', '71.28'], check: 'assert "BMI: 22.0" in __out__, "71.28 / 1.8**2 = 22.0（:.1f で .0 も表示）"' }],
      hint: 'float() で小数に変換してから計算。f"BMI: {bmi:.1f}"',
      solution: 'height = input("身長(m): ")\nweight = input("体重(kg): ")\nbmi = float(weight) / float(height) ** 2\nprint(f"BMI: {bmi:.1f}")\n' },
    { id: 'd2-4', title: '人生の残り時間', prompt: '今の年齢を入力し、90歳まで生きるとしたら残りが何日・何週・何か月あるかを表示しよう（1年 = 365日 = 52週 = 12か月とする）。\n\n表示形式: `残り 25550日、3640週、840か月です`',
      starter: 'age = int(input("今の年齢: "))\n',
      tests: [{ name: '20歳', inputs: ['20'], check: 'assert "残り 25550日、3640週、840か月です" in __out__, "期待: 残り 25550日、3640週、840か月です"' },
        { name: '56歳', inputs: ['56'], check: 'assert "残り 12410日、1768週、408か月です" in __out__, "90 - 56 = 34年"' }],
      hint: 'years = 90 - age として、years * 365 などを計算し f文字列で表示します。',
      solution: 'age = int(input("今の年齢: "))\nyears = 90 - age\nprint(f"残り {years * 365}日、{years * 52}週、{years * 12}か月です")\n' },
    { id: 'd2-1', title: 'ミニプロジェクト：割り勘計算', prompt: '合計金額（円）、チップの割合（%）、人数を入力し、1人あたりの金額を**小数第1位まで**表示しよう。\n\n表示形式: `1人あたり 3666.7 円`\n（例: 10000円、チップ10%、3人 → 10000×1.1÷3 = 3666.66… → 3666.7）',
      starter: 'total = float(input("合計金額は？ "))\ntip = int(input("チップは何%？ "))\npeople = int(input("何人で割る？ "))\n\n',
      tests: [
        { name: '10000円/10%/3人', inputs: ['10000', '10', '3'], check: 'assert "1人あたり 3666.7 円" in __out__, "期待: 1人あたり 3666.7 円"' },
        { name: '5000円/0%/2人', inputs: ['5000', '0', '2'], check: 'assert "1人あたり 2500.0 円" in __out__, "期待: 1人あたり 2500.0 円（:.1f を使うと .0 も表示されます）"' }],
      hint: 'per = total * (1 + tip / 100) / people を計算し、print(f"1人あたり {per:.1f} 円")',
      solution: 'total = float(input("合計金額は？ "))\ntip = int(input("チップは何%？ "))\npeople = int(input("何人で割る？ "))\nper = total * (1 + tip / 100) / people\nprint(f"1人あたり {per:.1f} 円")\n' },
  ],
},
{
  day: 3, title: '条件分岐 if / elif / else',
  goal: '比較演算子・論理演算子・ネストで処理を分ける',
  lesson: `### if 文
\`\`\`python
height = int(input("身長(cm): "))
if height >= 120:
    print("乗れます")
else:
    print("乗れません")
\`\`\`
- 比較演算子: \`>\` \`<\` \`>=\` \`<=\` \`==\`（等しい）\`!=\`（等しくない）
- **行末のコロン \`:\` とインデント（スペース4つ）**がブロックの目印。インデントがそろっていないと IndentationError

### elif（いくつかに分ける）
上から順に調べ、最初に当てはまったブロックだけを実行します。
\`\`\`python
if age < 12:
    price = 500
elif age <= 18:
    price = 700
else:
    price = 1200
\`\`\`
### ネスト（入れ子）と複数の if
\`\`\`python
if height >= 120:
    if age < 12:
        print("子ども料金")
    photo = input("写真を買う？(y/n) ")
    if photo == "y":       # elif ではなく別の if → 料金とは独立に判定
        price += 300
\`\`\`
### 論理演算子
\`and\`（両方）、\`or\`（どちらか）、\`not\`（否定）
\`\`\`python
if age >= 45 and age <= 55:   # 45 <= age <= 55 とも書ける
    print("無料")
\`\`\`
> 偶数判定は \`n % 2 == 0\`。大文字小文字を区別しないで比べたいときは \`text.lower()\` で小文字にそろえます。`,
  exercises: [
    { id: 'd3-2', title: '偶数？奇数？', prompt: '整数を入力し、偶数なら `偶数です`、奇数なら `奇数です` と表示しよう。',
      starter: 'n = int(input("整数: "))\n',
      tests: [
        { name: '8', inputs: ['8'], check: 'assert "偶数です" in __out__ and "奇数" not in __out__, "8は偶数"' },
        { name: '7', inputs: ['7'], check: 'assert "奇数です" in __out__ and "偶数" not in __out__, "7は奇数"' },
        { name: '0', inputs: ['0'], check: 'assert "偶数です" in __out__, "0は偶数"' }],
      hint: 'if n % 2 == 0:',
      solution: 'n = int(input("整数: "))\nif n % 2 == 0:\n    print("偶数です")\nelse:\n    print("奇数です")\n' },
    { id: 'd3-3', title: 'ジェットコースターの料金', prompt: '料金計算をしよう。\n- 身長 120cm 未満 → `ごめんなさい、乗れません` と表示して終わり\n- 乗れる場合、年齢で料金: 12歳未満 500円 / 18歳以下 700円 / それ以外 1200円\n- `写真を買いますか？(y/n) ` で y なら +300円\n- 最後に `料金は 1000 円です`',
      starter: 'height = int(input("身長(cm): "))\n',
      tests: [
        { name: '子ども＋写真', inputs: ['130', '10', 'y'], check: 'assert "料金は 800 円です" in __out__, "500 + 300 = 800"' },
        { name: '大人・写真なし', inputs: ['170', '30', 'n'], check: 'assert "料金は 1200 円です" in __out__, "大人1200円"' },
        { name: '18歳', inputs: ['165', '18', 'n'], check: 'assert "料金は 700 円です" in __out__, "18歳は700円"' },
        { name: '身長不足', inputs: ['110'], check: 'assert "ごめんなさい、乗れません" in __out__ and "料金" not in __out__, "120cm 未満は乗れない（年齢は聞かない）"' }],
      hint: 'if height >= 120: の中で age を聞き、if/elif/else で price を決める。写真は別の if で price += 300。else: で乗れないメッセージ。',
      solution: 'height = int(input("身長(cm): "))\nif height >= 120:\n    age = int(input("年齢: "))\n    if age < 12:\n        price = 500\n    elif age <= 18:\n        price = 700\n    else:\n        price = 1200\n    if input("写真を買いますか？(y/n) ") == "y":\n        price += 300\n    print(f"料金は {price} 円です")\nelse:\n    print("ごめんなさい、乗れません")\n' },
    { id: 'd3-1', title: 'うるう年判定', prompt: '西暦を入力し、うるう年なら `うるう年です`、そうでなければ `うるう年ではありません` と表示しよう。\n\nうるう年: 4で割り切れる年。ただし100で割り切れる年は除く。ただし400で割り切れる年はうるう年。',
      starter: 'year = int(input("西暦は？ "))\n',
      tests: [
        { name: '2024', inputs: ['2024'], check: 'assert "うるう年です" in __out__ and "ではありません" not in __out__, "2024年はうるう年"' },
        { name: '1900', inputs: ['1900'], check: 'assert "うるう年ではありません" in __out__, "1900年は100で割り切れるのでうるう年ではない"' },
        { name: '2000', inputs: ['2000'], check: 'assert "うるう年です" in __out__ and "ではありません" not in __out__, "2000年は400で割り切れるのでうるう年"' },
        { name: '2023', inputs: ['2023'], check: 'assert "うるう年ではありません" in __out__, "2023年はうるう年ではない"' }],
      hint: 'if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):',
      solution: 'year = int(input("西暦は？ "))\nif year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):\n    print("うるう年です")\nelse:\n    print("うるう年ではありません")\n' },
    { id: 'd3-4', title: 'ミニプロジェクト：宝探しアドベンチャー', prompt: '選択でストーリーが分かれるゲームを作ろう。入力は大文字小文字を区別しない（`.lower()`）。\n1. `分かれ道だ。left か right？ ` → right なら `落とし穴に落ちた… GAME OVER`\n2. left なら `湖に着いた。swim か wait？ ` → swim なら `ワニに襲われた… GAME OVER`\n3. wait なら `3つの扉がある。red / blue / yellow？ ` → yellow なら `宝を見つけた！ YOU WIN`、red なら `炎に包まれた… GAME OVER`、blue なら `獣が現れた… GAME OVER`、それ以外は `そんな扉はない… GAME OVER`',
      starter: 'print("宝島へようこそ！ 宝を見つけよう。")\n',
      tests: [
        { name: '勝ちルート', inputs: ['Left', 'wait', 'YELLOW'], check: 'assert "宝を見つけた！ YOU WIN" in __out__, "left → wait → yellow で勝ち（大文字でもOK）"' },
        { name: 'right', inputs: ['right'], check: 'assert "落とし穴に落ちた… GAME OVER" in __out__, "right は落とし穴"' },
        { name: 'swim', inputs: ['left', 'swim'], check: 'assert "ワニに襲われた… GAME OVER" in __out__, "swim はワニ"' },
        { name: '扉', inputs: ['left', 'wait', 'green'], check: 'assert "そんな扉はない… GAME OVER" in __out__, "それ以外の扉"' }],
      hint: 'ネストした if で書きます。choice = input("...").lower() のように受け取るとすぐ小文字になります。',
      solution: 'print("宝島へようこそ！ 宝を見つけよう。")\nif input("分かれ道だ。left か right？ ").lower() == "left":\n    if input("湖に着いた。swim か wait？ ").lower() == "wait":\n        door = input("3つの扉がある。red / blue / yellow？ ").lower()\n        if door == "yellow":\n            print("宝を見つけた！ YOU WIN")\n        elif door == "red":\n            print("炎に包まれた… GAME OVER")\n        elif door == "blue":\n            print("獣が現れた… GAME OVER")\n        else:\n            print("そんな扉はない… GAME OVER")\n    else:\n        print("ワニに襲われた… GAME OVER")\nelse:\n    print("落とし穴に落ちた… GAME OVER")\n' },
  ],
},
{
  day: 4, title: 'random とリスト',
  goal: '乱数、リストの作成・インデックス・追加、ネストしたリスト',
  lesson: `### モジュールと random
**モジュール**は便利な機能をまとめたファイル。\`import\` で読み込みます。
\`\`\`python
import random
print(random.randint(1, 6))        # 1〜6 の整数（両端を含む）
print(random.random())             # 0.0 以上 1.0 未満の小数
print(random.choice(["グー", "チョキ", "パー"]))
\`\`\`
> 乱数は「疑似乱数」。\`random.seed(1)\` のように種を決めると、毎回同じ並びになります（テストで使う技）。

### リスト
複数の値を順番に並べて1つにまとめたもの。
\`\`\`python
fruits = ["りんご", "みかん", "ぶどう"]
print(fruits[0])       # りんご（0から数える）
print(fruits[-1])      # ぶどう（後ろから）
fruits.append("もも")   # 末尾に追加
fruits[1] = "レモン"    # 書き換え
print(len(fruits))     # 4
print("もも" in fruits)  # True
\`\`\`
文字列 → リストは \`"a,b,c".split(",")\`、リスト → 文字列は \`", ".join(リスト)\`。

### ネストしたリスト
\`\`\`python
grid = [["a", "b"], ["c", "d"]]
print(grid[1][0])     # c（1番目のリストの0番目）
\`\`\`
> IndexError: list index out of range は「範囲外の番号」。長さ3のリストのインデックスは 0〜2 です。`,
  exercises: [
    { id: 'd4-2', title: 'コイントス', prompt: '`random.randint(0, 1)` で 0 なら `表`、1 なら `裏` と表示しよう。',
      starter: 'import random\n',
      tests: [{ name: '表か裏', check: 'assert __lines__ in (["表"], ["裏"]), f"「表」か「裏」の1行だけを表示しよう: {__lines__}"\nimport random\nresults = set()\nfor s in range(20):\n    random.seed(s)\n    import io, sys\n    buf = io.StringIO(); old = sys.stdout; sys.stdout = buf\n    exec(__code_src__, {})\n    sys.stdout = old\n    results.add(buf.getvalue().strip())\nassert results == {"表", "裏"}, "表と裏の両方が出るようにしよう（random を使っていますか？）"' }],
      hint: 'if random.randint(0, 1) == 0: print("表") else: print("裏")',
      solution: 'import random\nif random.randint(0, 1) == 0:\n    print("表")\nelse:\n    print("裏")\n' },
    { id: 'd4-1', title: '今日のおごり当番', prompt: 'カンマ区切りで名前を入力（例: `たろう,はなこ,じろう`）し、その中からランダムに1人選んで `今日のおごりは じろう さんです` と表示しよう。\n\n文字列の `split(",")` でリストにできます。',
      starter: 'import random\nnames_text = input("名前をカンマ区切りで: ")\nnames = names_text.split(",")\n',
      tests: [
        { name: '3人から選ぶ', inputs: ['たろう,はなこ,じろう'], check: 'import re\nm = re.search(r"今日のおごりは (.+) さんです", __out__)\nassert m, "「今日のおごりは ○○ さんです」の形式で表示しよう"\nassert m.group(1) in ["たろう","はなこ","じろう"], "入力した名前から選ばれていません"' },
        { name: '1人だけ', inputs: ['さくら'], check: 'assert "今日のおごりは さくら さんです" in __out__, "1人ならその人が選ばれるはず"' }],
      hint: 'who = random.choice(names) で1人選べます。',
      solution: 'import random\nnames_text = input("名前をカンマ区切りで: ")\nnames = names_text.split(",")\nwho = random.choice(names)\nprint(f"今日のおごりは {who} さんです")\n' },
    { id: 'd4-3', title: '宝の地図', prompt: '3×3 の地図（ネストしたリスト）に宝を置こう。`B3` のように「列の文字(A〜C)＋行の番号(1〜3)」を入力し、その場所を `X` にして地図を表示する。\n\n例: `B3` → 3行目の真ん中が X\n```\n⬜⬜⬜\n⬜⬜⬜\n⬜X⬜\n```',
      starter: 'row1 = ["⬜", "⬜", "⬜"]\nrow2 = ["⬜", "⬜", "⬜"]\nrow3 = ["⬜", "⬜", "⬜"]\nmap = [row1, row2, row3]\nposition = input("宝の場所は？（例: B3） ")\n\n# ここで map を書き換えよう\n\nprint("".join(row1))\nprint("".join(row2))\nprint("".join(row3))\n',
      tests: [
        { name: 'B3', inputs: ['B3'], check: 'assert __lines__[-3:] == ["⬜⬜⬜", "⬜⬜⬜", "⬜X⬜"], f"地図: {__lines__[-3:]}"' },
        { name: 'A1', inputs: ['A1'], check: 'assert __lines__[-3:] == ["X⬜⬜", "⬜⬜⬜", "⬜⬜⬜"], f"地図: {__lines__[-3:]}"' },
        { name: 'C2', inputs: ['C2'], check: 'assert __lines__[-3:] == ["⬜⬜⬜", "⬜⬜X", "⬜⬜⬜"], f"地図: {__lines__[-3:]}"' }],
      hint: '列は "ABC".index(position[0])、行は int(position[1]) - 1。map[行][列] = "X"',
      solution: 'row1 = ["⬜", "⬜", "⬜"]\nrow2 = ["⬜", "⬜", "⬜"]\nrow3 = ["⬜", "⬜", "⬜"]\nmap = [row1, row2, row3]\nposition = input("宝の場所は？（例: B3） ")\n\ncol = "ABC".index(position[0].upper())\nrow = int(position[1]) - 1\nmap[row][col] = "X"\n\nprint("".join(row1))\nprint("".join(row2))\nprint("".join(row3))\n' },
    { id: 'd4-4', title: 'ミニプロジェクト：じゃんけん', prompt: 'じゃんけんの勝敗を決める関数 `judge(user, cpu)` を完成させよう（0=グー, 1=チョキ, 2=パー）。`"勝ち"` `"負け"` `"あいこ"` を返す。0〜2 以外なら `"無効"`。\n\n下のコードは、関数を使ってコンピューターと対戦する部分です（そのままでOK）。',
      starter: 'import random\nhands = ["グー", "チョキ", "パー"]\n\ndef judge(user, cpu):\n    # ここを書こう（return で結果を返す）\n    pass\n\nuser = int(input("0=グー, 1=チョキ, 2=パー: "))\ncpu = random.randint(0, 2)\nif 0 <= user <= 2:\n    print(f"あなた: {hands[user]} / コンピューター: {hands[cpu]}")\nprint(judge(user, cpu))\n',
      tests: [
        { name: '勝ち', inputs: ['0'], check: 'assert judge(0, 1) == "勝ち" and judge(1, 2) == "勝ち" and judge(2, 0) == "勝ち", "グー>チョキ、チョキ>パー、パー>グー"' },
        { name: '負け・あいこ', inputs: ['0'], check: 'assert judge(1, 0) == "負け" and judge(0, 2) == "負け" and judge(2, 2) == "あいこ", "負けとあいこ"' },
        { name: '無効', inputs: ['5'], check: 'assert judge(5, 1) == "無効" and judge(-1, 0) == "無効", "0〜2 以外は 無効"\nassert "無効" in __out__' }],
      hint: 'まず無効のチェック、次に user == cpu であいこ。勝ちは (user, cpu) が (0,1) (1,2) (2,0) のとき。(cpu - user) % 3 == 1 なら勝ち、という書き方もできます。',
      solution: 'import random\nhands = ["グー", "チョキ", "パー"]\n\ndef judge(user, cpu):\n    if user < 0 or user > 2:\n        return "無効"\n    if user == cpu:\n        return "あいこ"\n    if (user, cpu) in [(0, 1), (1, 2), (2, 0)]:\n        return "勝ち"\n    return "負け"\n\nuser = int(input("0=グー, 1=チョキ, 2=パー: "))\ncpu = random.randint(0, 2)\nif 0 <= user <= 2:\n    print(f"あなた: {hands[user]} / コンピューター: {hands[cpu]}")\nprint(judge(user, cpu))\n' },
  ],
},
{
  day: 5, title: 'for ループと range',
  goal: 'リストの繰り返し、range、合計・最大値を自分で求める',
  lesson: `### for ループ
\`\`\`python
for fruit in ["りんご", "みかん"]:
    print(fruit + "が好き")       # インデントした部分が繰り返される
print("おしまい")                 # インデントなし → ループの後に1回だけ
\`\`\`
### range
\`\`\`python
for i in range(1, 6):      # 1,2,3,4,5（終わりの数は含まない）
    print(i)
for i in range(0, 10, 2):  # 0,2,4,6,8（ステップ2）
    print(i)
for _ in range(3):         # 回数だけ決まっていて番号を使わないとき
    print("やあ")
\`\`\`
### 合計と最大値を自分で求める
\`sum()\` や \`max()\` は便利ですが、仕組みを理解するため自分でも書いてみましょう。
\`\`\`python
scores = [72, 88, 95, 60]
total = 0
best = scores[0]
for s in scores:
    total += s
    if s > best:
        best = s
print(total, best)
\`\`\`
### 文字列を組み立てる
\`\`\`python
password = ""
for _ in range(4):
    password += random.choice("abc123")
\`\`\`
> FizzBuzz: 3の倍数で Fizz、5の倍数で Buzz、両方の倍数で FizzBuzz。15の倍数の判定を**先に**書くのがコツ。`,
  exercises: [
    { id: 'd5-3', title: '偶数だけの合計', prompt: '整数 n を入力し、1 から n までの**偶数の合計**を `合計: 2550` のように表示しよう（sum() は使わない）。',
      starter: 'n = int(input("n: "))\ntotal = 0\n',
      tests: [
        { name: '100', inputs: ['100'], check: 'assert "合計: 2550" in __out__, "2+4+…+100 = 2550"' },
        { name: '7', inputs: ['7'], check: 'assert "合計: 12" in __out__, "2+4+6 = 12"' },
        { name: 'sum 不使用', inputs: ['10'], check: 'assert "sum(" not in __code_src__, "sum() を使わずに for で書いてみよう"' }],
      hint: 'for i in range(2, n + 1, 2): total += i',
      solution: 'n = int(input("n: "))\ntotal = 0\nfor i in range(2, n + 1, 2):\n    total += i\nprint(f"合計: {total}")\n' },
    { id: 'd5-2', title: 'max を使わずに最高点', prompt: 'スペース区切りの点数（例: `72 88 95 60`）を入力し、`max()` や `sum()` を使わずに、`合計: 315` と `最高: 95` を表示しよう。',
      starter: 'scores = input("点数: ").split()\nfor i in range(len(scores)):\n    scores[i] = int(scores[i])\n# max() と sum() は使わないこと\n',
      tests: [
        { name: '72 88 95 60', inputs: ['72 88 95 60'], check: 'assert "合計: 315" in __out__ and "最高: 95" in __out__, "合計: 315 / 最高: 95 になるはず"' },
        { name: '負の数を含む', inputs: ['-5 -2 -9'], check: 'assert "最高: -2" in __out__, "最初の値を best の初期値にしよう（0 から始めると負の数で失敗）"' },
        { name: '組み込み不使用', inputs: ['1 2'], check: 'assert "max(" not in __code_src__ and "sum(" not in __code_src__, "max() / sum() を使わずに書いてみよう"' }],
      hint: 'best = scores[0] から始めて、for で大きい値が来たら更新します。',
      solution: 'scores = input("点数: ").split()\nfor i in range(len(scores)):\n    scores[i] = int(scores[i])\ntotal = 0\nbest = scores[0]\nfor s in scores:\n    total += s\n    if s > best:\n        best = s\nprint(f"合計: {total}")\nprint(f"最高: {best}")\n' },
    { id: 'd5-1', title: 'FizzBuzz', prompt: '1 から 30 まで、3の倍数なら `Fizz`、5の倍数なら `Buzz`、両方なら `FizzBuzz`、それ以外は数字を1行ずつ表示しよう。',
      starter: 'for n in range(1, 31):\n    pass  # ここを書き換えよう\n',
      tests: [{ name: '1〜30', inputs: [], check: 'exp = ["FizzBuzz" if n%15==0 else "Fizz" if n%3==0 else "Buzz" if n%5==0 else str(n) for n in range(1,31)]\nassert __lines__ == exp, "1〜30 の30行を出力しよう。最初の数行: " + " ".join(exp[:6])' }],
      hint: 'if n % 15 == 0: → elif n % 3 == 0: → elif n % 5 == 0: → else: の順に。',
      solution: 'for n in range(1, 31):\n    if n % 15 == 0:\n        print("FizzBuzz")\n    elif n % 3 == 0:\n        print("Fizz")\n    elif n % 5 == 0:\n        print("Buzz")\n    else:\n        print(n)\n' },
    { id: 'd5-4', title: 'ミニプロジェクト：パスワード生成器', prompt: '英字の数・記号の数・数字の数を入力し、その数だけランダムに選んだパスワードを `パスワード: ...` と表示しよう。\n\n上級: 文字の並びもシャッフルする（`random.shuffle(リスト)`）。',
      starter: 'import random\nletters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"\nsymbols = "!#$%&()*+"\nnumbers = "0123456789"\n\nn_letters = int(input("英字は何文字？ "))\nn_symbols = int(input("記号は何文字？ "))\nn_numbers = int(input("数字は何文字？ "))\n',
      tests: [{ name: '4/2/3', inputs: ['4', '2', '3'], check: 'import re\nm = re.search(r"パスワード: (\\S+)", __out__)\nassert m, "「パスワード: ...」と表示しよう"\npw = m.group(1)\nassert len(pw) == 9, f"長さは 4+2+3=9 のはず: {pw}"\nassert sum(c.isalpha() for c in pw) == 4 and sum(c.isdigit() for c in pw) == 3 and sum(c in "!#$%&()*+" for c in pw) == 2, f"英字4・記号2・数字3 になっていません: {pw}"' }],
      hint: 'chars = [] にして for _ in range(n_letters): chars.append(random.choice(letters)) を3種類分。random.shuffle(chars) してから "".join(chars)。',
      solution: 'import random\nletters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"\nsymbols = "!#$%&()*+"\nnumbers = "0123456789"\n\nn_letters = int(input("英字は何文字？ "))\nn_symbols = int(input("記号は何文字？ "))\nn_numbers = int(input("数字は何文字？ "))\n\nchars = []\nfor _ in range(n_letters):\n    chars.append(random.choice(letters))\nfor _ in range(n_symbols):\n    chars.append(random.choice(symbols))\nfor _ in range(n_numbers):\n    chars.append(random.choice(numbers))\nrandom.shuffle(chars)\nprint("パスワード: " + "".join(chars))\n' },
  ],
},
{
  day: 6, title: '関数と while ループ',
  goal: 'def で関数を定義し、while で条件付きの繰り返しをする',
  lesson: `### 関数の定義
何度も使う処理に名前を付けてまとめます。
\`\`\`python
def greet():
    print("おはよう")
    print("今日もがんばろう")

greet()   # 呼び出し（定義より後で）
greet()
\`\`\`
- \`def 名前():\` の次の行から、**インデントした部分**が関数の中身
- 定義しただけでは実行されない。呼び出して初めて動く

### 関数を組み合わせる
\`\`\`python
def turn_left():
    print("左を向く")

def turn_right():        # 左を3回で右！
    turn_left()
    turn_left()
    turn_left()
\`\`\`
### while ループ
条件が True の間くり返します。条件がいつか False にならないと**無限ループ**（このアプリでは12秒で自動停止します）。
\`\`\`python
n = 3
while n > 0:
    print(n)
    n -= 1
print("発射！")
\`\`\`
> for は「回数や要素が決まっているとき」、while は「条件を満たすまで（回数が分からない）」のときに使います。`,
  exercises: [
    { id: 'd6-2', title: 'ロボットを右に曲げる', prompt: 'ロボットは `move()`（1マス前進）と `turn_left()`（左を向く）しかできません。`turn_right()` を **turn_left() を使って**定義し、次の動きでゴール (2, 2) に着かせよう。\n\n「前進 → 前進 → 左 → 前進 → 前進」…ではなく、ロボットは最初**北（上）**を向いて (0, 0) にいます。\n① 右を向く ② 2マス前進 ③ 左を向く ④ 2マス前進',
      starter: '# --- ロボット（変更しない） ---\nx, y = 0, 0\ndirs = [(0, 1), (-1, 0), (0, -1), (1, 0)]  # 北・西・南・東（左回り）\nd = 0\ndef move():\n    global x, y\n    x += dirs[d][0]\n    y += dirs[d][1]\ndef turn_left():\n    global d\n    d = (d + 1) % 4\n# ---------------------------\n\ndef turn_right():\n    pass  # turn_left を使って書こう\n\n# ここでロボットを動かそう\n\nprint(f"ロボットの位置: ({x}, {y})")\n',
      tests: [
        { name: 'ゴール', check: 'assert "ロボットの位置: (2, 2)" in __out__, f"今の位置は ({x}, {y})。(2, 2) を目指そう"' },
        { name: 'turn_right', check: 'd0 = d\nturn_right()\nassert d == (d0 - 1) % 4, "turn_right() で右を向くようにしよう（turn_left を3回）"' }],
      hint: 'def turn_right(): の中で turn_left() を3回。動きは turn_right() → move() ×2 → turn_left() → move() ×2',
      solution: '# --- ロボット（変更しない） ---\nx, y = 0, 0\ndirs = [(0, 1), (-1, 0), (0, -1), (1, 0)]  # 北・西・南・東（左回り）\nd = 0\ndef move():\n    global x, y\n    x += dirs[d][0]\n    y += dirs[d][1]\ndef turn_left():\n    global d\n    d = (d + 1) % 4\n# ---------------------------\n\ndef turn_right():\n    turn_left()\n    turn_left()\n    turn_left()\n\nturn_right()\nmove()\nmove()\nturn_left()\nmove()\nmove()\n\nprint(f"ロボットの位置: ({x}, {y})")\n' },
    { id: 'd6-1', title: '貯金シミュレーター', prompt: '目標金額を入力し、毎月 3000 円ずつ貯金したとき、何か月で目標に到達するかを while で求め、`12か月で達成` のように表示しよう。',
      starter: 'goal = int(input("目標金額: "))\nsaved = 0\nmonths = 0\n',
      tests: [
        { name: '36000円', inputs: ['36000'], check: 'assert "12か月で達成" in __out__, "36000円なら12か月"' },
        { name: '10000円', inputs: ['10000'], check: 'assert "4か月で達成" in __out__, "10000円なら4か月（3000×4=12000）"' }],
      hint: 'while saved < goal: の中で saved += 3000 と months += 1。',
      solution: 'goal = int(input("目標金額: "))\nsaved = 0\nmonths = 0\nwhile saved < goal:\n    saved += 3000\n    months += 1\nprint(f"{months}か月で達成")\n' },
    { id: 'd6-3', title: '正しい答えが出るまで', prompt: '`7 × 8 = ? ` と聞き、正解（56）が入力されるまで `ちがいます` と言って聞き続けよう。正解したら `正解！ 3回目で正解しました` のように何回目かを表示。',
      starter: 'tries = 0\n',
      tests: [
        { name: '3回目', inputs: ['54', '58', '56'], check: 'assert __out__.count("ちがいます") == 2, "不正解のたびに「ちがいます」"\nassert "正解！ 3回目で正解しました" in __out__' },
        { name: '1回目', inputs: ['56'], check: 'assert "正解！ 1回目で正解しました" in __out__ and "ちがいます" not in __out__' }],
      hint: 'while True: で聞き、正解なら break。break しない限り続きます。または answer = None; while answer != 56: …',
      solution: 'tries = 0\nwhile True:\n    tries += 1\n    if int(input("7 × 8 = ? ")) == 56:\n        break\n    print("ちがいます")\nprint(f"正解！ {tries}回目で正解しました")\n' },
  ],
},
{
  day: 7, title: 'ミニプロジェクト：単語当てゲーム', project: true,
  goal: 'ループ・条件分岐・リスト・random を組み合わせてゲームを作る',
  lesson: `### ゲームの流れ
1. 答えの単語を決める
2. 画面には \`_ _ _ _ _ _\` のように伏せ字を表示
3. 1文字ずつ予想させ、当たればその位置を公開、外れればライフ -1
4. 全部当てたら勝ち、ライフ 0 で負け

### 大きな問題を小さく分ける
いきなり全部書かず、①伏せ字を作る ②1文字の当たり判定 ③ループ ④勝敗、と1つずつ動かしながら作ります。

\`\`\`python
word = "python"
display = ["_"] * len(word)          # ["_", "_", ...]
for i in range(len(word)):
    if word[i] == "t":
        display[i] = "t"
print(" ".join(display))   # _ _ t _ _ _
\`\`\`
\`enumerate()\` を使うと位置と文字を同時に取り出せます：\`for i, ch in enumerate(word):\`

### 終了条件
\`\`\`python
while "_" in display and lives > 0:
    ...
\`\`\`
> \`"_" not in display\` で「全部当てたか」を判定できます。同じ文字を二度予想したときの処理など、細かい仕様を足していくのがプログラミングの楽しいところ。`,
  exercises: [
    { id: 'd7-1', title: 'ステップ1：固定の単語で', prompt: '答え `python`、ライフ 3 の単語当てゲームを作ろう。\n- 毎回 `_ _ t _ _ _` の形式で伏せ字を表示してから input で1文字聞く\n- 外れたら `はずれ！残りライフ 2`\n- 全部当てたら `正解！ python`、ライフが 0 になったら `ゲームオーバー 答えは python`',
      starter: 'word = "python"\nlives = 3\ndisplay = ["_"] * len(word)\n\n',
      tests: [
        { name: '全部当てる', inputs: ['p', 'y', 't', 'h', 'o', 'n'], check: 'assert "正解！ python" in __out__, "全部当てたら「正解！ python」"\nassert "_ _ _ _ _ _" in __out__, "最初に伏せ字「_ _ _ _ _ _」を表示しよう"' },
        { name: '3回外す', inputs: ['a', 'b', 'c'], check: 'assert "はずれ！残りライフ 2" in __out__, "外れたら「はずれ！残りライフ 2」"\nassert "ゲームオーバー 答えは python" in __out__, "ライフ0で「ゲームオーバー 答えは python」"' },
        { name: '途中で外しても勝てる', inputs: ['z', 'p', 'y', 't', 'h', 'o', 'n'], check: 'assert "正解！ python" in __out__ and "はずれ！残りライフ 2" in __out__, "1回外しても勝てるはず"' }],
      hint: 'while "_" in display and lives > 0: の中で表示 → input → 当たり判定。ループの後で勝敗を表示します。',
      solution: 'word = "python"\nlives = 3\ndisplay = ["_"] * len(word)\n\nwhile "_" in display and lives > 0:\n    print(" ".join(display))\n    guess = input("1文字: ").lower()\n    if guess in word:\n        for i, ch in enumerate(word):\n            if ch == guess:\n                display[i] = ch\n    else:\n        lives -= 1\n        print(f"はずれ！残りライフ {lives}")\n\nif "_" not in display:\n    print("正解！ " + word)\nelse:\n    print("ゲームオーバー 答えは " + word)\n' },
    { id: 'd7-2', title: 'ステップ2：ランダムな単語と二度押し対策', prompt: 'ステップ1を改良しよう。\n- 答えは `words` からランダムに選ぶ、ライフは 6\n- すでに予想した文字をもう一度入力したら `すでに予想した文字です` と表示（ライフは減らさない）\n- 終了時の表示はステップ1と同じ形式（`正解！ 単語` / `ゲームオーバー 答えは 単語`）',
      starter: 'import random\nwords = ["apple", "melon", "grape", "peach", "lemon"]\nword = random.choice(words)\nlives = 6\ndisplay = ["_"] * len(word)\nguessed = []\n\n',
      tests: [
        { name: '二度押し', inputs: ['e', 'e', 'a', 'p', 'l', 'm', 'o', 'n', 'g', 'r', 'c', 'h', 'b', 'd', 'f', 'i', 'j', 'k'], check: 'assert "すでに予想した文字です" in __out__, "同じ文字を2回入力したら「すでに予想した文字です」"\nassert ("正解！ " + word) in __out__, "e,a,p,l,m,o,n,g,r,c,h でどの単語も当たるはず"' },
        { name: '負け', inputs: ['x', 'z', 'q', 'w', 'v', 'u', 'y'], check: 'assert ("ゲームオーバー 答えは " + word) in __out__, "6回外したらゲームオーバー"\nassert "はずれ！残りライフ 0" in __out__' }],
      hint: 'if guess in guessed: print(...); continue。そうでなければ guessed.append(guess) してから判定。',
      solution: 'import random\nwords = ["apple", "melon", "grape", "peach", "lemon"]\nword = random.choice(words)\nlives = 6\ndisplay = ["_"] * len(word)\nguessed = []\n\nwhile "_" in display and lives > 0:\n    print(" ".join(display))\n    guess = input("1文字: ").lower()\n    if guess in guessed:\n        print("すでに予想した文字です")\n        continue\n    guessed.append(guess)\n    if guess in word:\n        for i, ch in enumerate(word):\n            if ch == guess:\n                display[i] = ch\n    else:\n        lives -= 1\n        print(f"はずれ！残りライフ {lives}")\n\nif "_" not in display:\n    print("正解！ " + word)\nelse:\n    print("ゲームオーバー 答えは " + word)\n' },
  ],
},
{
  day: 8, title: '引数のある関数',
  goal: '引数（パラメータ）、位置引数とキーワード引数、デフォルト値',
  lesson: `### 引数
関数に値を渡して、同じ処理を違うデータで使えるようにします。
\`\`\`python
def greet(name):              # name がパラメータ（受け取る変数）
    print(f"{name}さん、こんにちは")

greet("たろう")                # "たろう" が引数（渡す値）
\`\`\`
### 複数の引数
\`\`\`python
def greet(name, time="朝"):      # time はデフォルト値つき
    print(f"{name}さん、{time}ですね")

greet("たろう")                   # 位置引数（順番で対応）
greet("はなこ", "夜")
greet(time="昼", name="じろう")    # キーワード引数（名前で指定、順番自由）
\`\`\`
### 例：切り上げの計算
\`\`\`python
import math
math.ceil(2.1)    # 3（切り上げ）
math.floor(2.9)   # 2（切り捨て）
\`\`\`
### シーザー暗号
アルファベットを決まった数だけずらす暗号です。
\`\`\`python
alphabet = "abcdefghijklmnopqrstuvwxyz"
i = alphabet.index("y")           # 24
print(alphabet[(i + 3) % 26])     # b（% 26 で一周する）
\`\`\``,
  exercises: [
    { id: 'd8-2', title: 'ペンキ缶の計算', prompt: '関数 `paint_cans(height, width, coverage=5)` を作ろう。壁の面積（高さ×幅、㎡）を塗るのに必要なペンキ缶の数を、**切り上げた整数**で返す。1缶で coverage ㎡ 塗れる。\n\n例: 高さ3・幅9 → 27㎡ ÷ 5 = 5.4 → 6缶',
      starter: 'import math\n\ndef paint_cans(height, width, coverage=5):\n    pass\n\nprint(paint_cans(3, 9))\n',
      tests: [{ name: '計算', check: 'assert paint_cans(3, 9) == 6, "27㎡ → 6缶"\nassert paint_cans(2, 5) == 2, "10㎡ → ちょうど2缶"\nassert paint_cans(3, 9, coverage=10) == 3, "coverage=10 なら 3缶"' }],
      hint: 'return math.ceil(height * width / coverage)',
      solution: 'import math\n\ndef paint_cans(height, width, coverage=5):\n    return math.ceil(height * width / coverage)\n\nprint(paint_cans(3, 9))\n' },
    { id: 'd8-3', title: '素数チェッカー', prompt: '関数 `is_prime(n)` を作ろう。n が素数なら True、そうでなければ False を返す（1 は素数ではない）。',
      starter: 'def is_prime(n):\n    pass\n\nprint(is_prime(7))\n',
      tests: [{ name: '判定', check: 'assert [n for n in range(1, 30) if is_prime(n)] == [2, 3, 5, 7, 11, 13, 17, 19, 23, 29], f"1〜29 の素数の判定が違います: {[n for n in range(1, 30) if is_prime(n)]}"\nassert is_prime(97) is True and is_prime(1) is False' }],
      hint: 'n < 2 なら False。for i in range(2, n): で n % i == 0 になるものがあれば False、なければ最後に True。',
      solution: 'def is_prime(n):\n    if n < 2:\n        return False\n    for i in range(2, n):\n        if n % i == 0:\n            return False\n    return True\n\nprint(is_prime(7))\n' },
    { id: 'd8-1', title: 'ミニプロジェクト：シーザー暗号', prompt: '関数 `caesar(text, shift)` を作ろう。小文字アルファベットを shift 文字ずらし、それ以外（数字・記号・空白）はそのまま返す。shift が負なら逆方向（復号）。\n\n例: `caesar("hello world!", 3)` → `"khoor zruog!"`',
      starter: 'alphabet = "abcdefghijklmnopqrstuvwxyz"\n\ndef caesar(text, shift):\n    result = ""\n    # ここを書こう\n    return result\n\nprint(caesar("hello world!", 3))\n',
      tests: [
        { name: '暗号化', check: 'assert caesar("hello world!", 3) == "khoor zruog!", "caesar(\\"hello world!\\", 3) は \\"khoor zruog!\\""' },
        { name: '一周する', check: 'assert caesar("xyz", 3) == "abc", "z の次は a に戻る（% 26）"' },
        { name: '復号', check: 'assert caesar("khoor", -3) == "hello", "shift が負なら戻す"' }],
      hint: 'for ch in text: で、ch が alphabet にあれば alphabet[(alphabet.index(ch) + shift) % 26] を足し、なければ ch をそのまま足します。',
      solution: 'alphabet = "abcdefghijklmnopqrstuvwxyz"\n\ndef caesar(text, shift):\n    result = ""\n    for ch in text:\n        if ch in alphabet:\n            result += alphabet[(alphabet.index(ch) + shift) % 26]\n        else:\n            result += ch\n    return result\n\nprint(caesar("hello world!", 3))\n' },
  ],
},
{
  day: 9, title: '辞書とネスト',
  goal: '辞書（dict）の作成・追加・ループ、リストと辞書の入れ子',
  lesson: `### 辞書
キー（見出し）と値のペアでデータを持ちます。リストは番号で、辞書は**キーで**取り出します。
\`\`\`python
scores = {"たろう": 81, "はなこ": 92}
print(scores["はなこ"])     # 92
scores["じろう"] = 67       # 追加（すでにあれば上書き）
print(len(scores))          # 3
print("たろう" in scores)    # True（キーがあるか）
for name in scores:          # キーでループ
    print(name, scores[name])
for name, s in scores.items():   # キーと値を同時に
    print(name, s)
\`\`\`
- 存在しないキーを使うと KeyError。\`scores.get("さくら", 0)\` なら無いとき 0
- 空の辞書は \`{}\`

### ネスト（入れ子）
\`\`\`python
travel_log = [
    {"country": "フランス", "visits": 2, "cities": ["パリ", "リヨン"]},
    {"country": "日本", "visits": 5, "cities": ["京都"]},
]
print(travel_log[0]["cities"][1])   # リヨン
\`\`\`
> 実際のアプリや Web API のデータはほとんどが「辞書とリストの入れ子」。読み書きに慣れておくと後でとても役に立ちます。`,
  exercises: [
    { id: 'd9-1', title: '成績を評価に変換', prompt: '関数 `grade_all(scores)` を作ろう。名前→点数の辞書を受け取り、名前→評価の**新しい辞書**を返す。\n- 90以上 `S` / 80以上 `A` / 70以上 `B` / それ未満 `C`',
      starter: 'def grade_all(scores):\n    grades = {}\n    # ここを書こう\n    return grades\n\nprint(grade_all({"たろう": 81, "はなこ": 92, "じろう": 67}))\n',
      tests: [{ name: '4人', check: 'r = grade_all({"たろう": 81, "はなこ": 92, "じろう": 67, "さくら": 70})\nassert r == {"たろう": "A", "はなこ": "S", "じろう": "C", "さくら": "B"}, f"結果: {r}"' }],
      hint: 'for name, s in scores.items(): で点数を判定して grades[name] = "A" のように入れます。',
      solution: 'def grade_all(scores):\n    grades = {}\n    for name, s in scores.items():\n        if s >= 90:\n            grades[name] = "S"\n        elif s >= 80:\n            grades[name] = "A"\n        elif s >= 70:\n            grades[name] = "B"\n        else:\n            grades[name] = "C"\n    return grades\n\nprint(grade_all({"たろう": 81, "はなこ": 92, "じろう": 67}))\n' },
    { id: 'd9-3', title: '旅行記録に追加', prompt: '関数 `add_visit(log, country, visits, cities)` を作ろう。`{"country": ..., "visits": ..., "cities": [...]}` の辞書を log（リスト）に追加する。\n\nその後 `total_visits(log)` で全ての visits の合計を返す関数も作ろう。',
      starter: 'travel_log = [\n    {"country": "フランス", "visits": 2, "cities": ["パリ", "リヨン"]},\n]\n\ndef add_visit(log, country, visits, cities):\n    pass\n\ndef total_visits(log):\n    pass\n\nadd_visit(travel_log, "台湾", 3, ["台北", "台南"])\nprint(travel_log)\nprint(total_visits(travel_log))\n',
      tests: [{ name: '追加と合計', check: 'log = []\nadd_visit(log, "日本", 5, ["京都"])\nassert log == [{"country": "日本", "visits": 5, "cities": ["京都"]}], f"追加された内容: {log}"\nadd_visit(log, "韓国", 1, ["ソウル"])\nassert total_visits(log) == 6, "5 + 1 = 6"\nassert travel_log[-1]["cities"][0] == "台北"' }],
      hint: 'log.append({"country": country, "visits": visits, "cities": cities})。合計は for で visits を足します。',
      solution: 'travel_log = [\n    {"country": "フランス", "visits": 2, "cities": ["パリ", "リヨン"]},\n]\n\ndef add_visit(log, country, visits, cities):\n    log.append({"country": country, "visits": visits, "cities": cities})\n\ndef total_visits(log):\n    total = 0\n    for entry in log:\n        total += entry["visits"]\n    return total\n\nadd_visit(travel_log, "台湾", 3, ["台北", "台南"])\nprint(travel_log)\nprint(total_visits(travel_log))\n' },
    { id: 'd9-2', title: 'ミニプロジェクト：秘密のオークション', prompt: '入札者の名前と金額を繰り返し入力し、`続ける？(y/n)` に n が入力されたら終了。最高額の人を `落札者は はなこ さん（5000円）` と表示しよう。',
      starter: 'bids = {}\n\n',
      tests: [{ name: '3人', inputs: ['たろう', '3000', 'y', 'はなこ', '5000', 'y', 'じろう', '4000', 'n'], check: 'assert "落札者は はなこ さん（5000円）" in __out__, "最高額は はなこ の 5000円"' }],
      hint: 'while True: で 名前→金額→続ける？ を聞き、n なら break。最後に for で最大を探します。',
      solution: 'bids = {}\nwhile True:\n    name = input("名前: ")\n    bids[name] = int(input("金額: "))\n    if input("続ける？(y/n) ") == "n":\n        break\n\nwinner = ""\nbest = 0\nfor name, amount in bids.items():\n    if amount > best:\n        winner = name\n        best = amount\nprint(f"落札者は {winner} さん（{best}円）")\n' },
  ],
},
{
  day: 10, title: '戻り値のある関数',
  goal: 'return、複数の return、docstring、関数を組み合わせる',
  lesson: `### return
関数の結果を呼び出し元に返します。
\`\`\`python
def area(w, h):
    """長方形の面積を返す"""    # docstring（関数の説明。エディタで表示される）
    return w * h

a = area(3, 4)       # 戻り値を変数に入れる
print(area(2, 5) + a)
\`\`\`
- return に来ると関数はそこで終了（その後の行は実行されない）
- return がない関数は \`None\` を返す
- **print は表示するだけ、return は値を渡す**。return した値は計算や他の関数に再利用できる

### 早期 return
\`\`\`python
def format_name(first, last):
    if first == "" or last == "":
        return "名前が入力されていません"
    return f"{first.title()} {last.title()}"
\`\`\`
### 関数を値として扱う
関数も変数や辞書に入れられます（電卓で使う技）。
\`\`\`python
def add(a, b):
    return a + b
operations = {"+": add}
print(operations["+"](2, 3))   # 5
\`\`\``,
  exercises: [
    { id: 'd10-2', title: '名前を整える', prompt: '`format_name(first, last)` を作ろう。先頭だけ大文字にして `"Ada Lovelace"` のように返す（`.title()`）。どちらかが空文字なら `"名前が入力されていません"` を返す。',
      starter: 'def format_name(first, last):\n    pass\n\nprint(format_name("ada", "LOVELACE"))\n',
      tests: [{ name: '整形', check: 'assert format_name("ada", "LOVELACE") == "Ada Lovelace", "Ada Lovelace になるはず"\nassert format_name("", "x") == "名前が入力されていません" and format_name("a", "") == "名前が入力されていません"' }],
      hint: 'if first == "" or last == "": return "…" を先に。その後 return f"{first.title()} {last.title()}"',
      solution: 'def format_name(first, last):\n    if first == "" or last == "":\n        return "名前が入力されていません"\n    return f"{first.title()} {last.title()}"\n\nprint(format_name("ada", "LOVELACE"))\n' },
    { id: 'd10-1', title: '月の日数', prompt: '`is_leap(year)` と `days_in_month(year, month)` を作ろう。days_in_month は is_leap を使って2月の日数を判定する。\n\n例: `days_in_month(2024, 2)` → 29、`days_in_month(2023, 4)` → 30',
      starter: 'def is_leap(year):\n    pass\n\ndef days_in_month(year, month):\n    days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]\n    pass\n\nprint(days_in_month(2024, 2))\n',
      tests: [
        { name: 'is_leap', check: 'assert is_leap(2024) is True and is_leap(1900) is False and is_leap(2000) is True, "is_leap が True/False を返すようにしよう"' },
        { name: '日数', check: 'assert days_in_month(2024, 2) == 29 and days_in_month(2023, 2) == 28 and days_in_month(2023, 4) == 30 and days_in_month(2023, 12) == 31, "days_in_month の結果が違います"' }],
      hint: 'is_leap は return year % 4 == 0 and (...) の1行で書けます。days_in_month は month == 2 and is_leap(year) なら 29、それ以外は days[month - 1]。',
      solution: 'def is_leap(year):\n    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)\n\ndef days_in_month(year, month):\n    days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]\n    if month == 2 and is_leap(year):\n        return 29\n    return days[month - 1]\n\nprint(days_in_month(2024, 2))\n' },
    { id: 'd10-3', title: 'ミニプロジェクト：電卓', prompt: '電卓を作ろう。\n- `add` `subtract` `multiply` `divide` の4関数と、記号→関数の辞書 `operations`\n- 最初の数を聞き、`記号は？(+ - * /) ` `次の数は？ ` で計算して `3.0 + 4.0 = 7.0` と表示\n- `続けて計算する？(y/n) ` で y なら前の答えを使って続ける、n なら終了',
      starter: 'def add(a, b):\n    return a + b\n\n# subtract, multiply, divide も作ろう\n\noperations = {\n    "+": add,\n}\n\n',
      tests: [
        { name: '連続計算', inputs: ['3', '+', '4', 'y', '*', '2', 'n'], check: 'assert "3.0 + 4.0 = 7.0" in __out__, "3.0 + 4.0 = 7.0"\nassert "7.0 * 2.0 = 14.0" in __out__, "続けて 7.0 * 2.0 = 14.0"' },
        { name: '関数と辞書', inputs: ['1', '-', '1', 'n'], check: 'assert set(operations) == {"+", "-", "*", "/"}, "operations に4つの記号を登録しよう"\nassert operations["/"](9, 2) == 4.5 and operations["-"](5, 8) == -3' }],
      hint: 'num1 = float(input(...)); while True: で記号と次の数を聞き、answer = operations[op](num1, num2)。y なら num1 = answer、n なら break。',
      solution: 'def add(a, b):\n    return a + b\n\ndef subtract(a, b):\n    return a - b\n\ndef multiply(a, b):\n    return a * b\n\ndef divide(a, b):\n    return a / b\n\noperations = {\n    "+": add,\n    "-": subtract,\n    "*": multiply,\n    "/": divide,\n}\n\nnum1 = float(input("最初の数は？ "))\nwhile True:\n    op = input("記号は？(+ - * /) ")\n    num2 = float(input("次の数は？ "))\n    answer = operations[op](num1, num2)\n    print(f"{num1} {op} {num2} = {answer}")\n    if input("続けて計算する？(y/n) ") == "y":\n        num1 = answer\n    else:\n        break\n' },
  ],
},
];
