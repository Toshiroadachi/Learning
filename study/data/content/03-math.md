@@unit math-2-01
@image
$(a+b)^2 = a^2 + 2ab + b^2$ は中学で習いました。では $(a+b)^5$ は？ 1つずつ掛けていくと大変です。

**二項定理** は、$(a+b)^n$ を展開したときの **各項の係数を、組合せの数 ${}_n\mathrm{C}_r$ で一気に求める** 方法です。

たとえば $(a+b)^3 = (a+b)(a+b)(a+b)$ を展開するのは、「3つのカッコから、それぞれ $a$ か $b$ を1つずつ選んで掛ける」こと。$a^2b$ になる選び方は「3つのうちどれで $b$ を選ぶか」で ${}_3\mathrm{C}_1 = 3$ 通り。だから $a^2b$ の係数は 3 になる ── これが二項定理のしくみです。

@detail
### 1. まずは3乗の公式
$$(a+b)^3 = a^3 + 3a^2b + 3ab^2 + b^3$$
$$(a-b)^3 = a^3 - 3a^2b + 3ab^2 - b^3$$
係数は 1, 3, 3, 1。

### 2. パスカルの三角形
| n | 係数 |
|---|---|
| 1 | 1　1 |
| 2 | 1　2　1 |
| 3 | 1　3　3　1 |
| 4 | 1　4　6　4　1 |
| 5 | 1　5　10　10　5　1 |
上の段の隣どうしを足すと下の段になります（例：3＋3＝6）。

### 3. 二項定理
$$(a+b)^n = {}_n\mathrm{C}_0 a^n + {}_n\mathrm{C}_1 a^{n-1}b + \cdots + {}_n\mathrm{C}_r a^{n-r}b^r + \cdots + {}_n\mathrm{C}_n b^n$$
**一般項**（$r$ 番目の項）は：
$${}_n\mathrm{C}_r \, a^{n-r} \, b^r$$
- ${}_n\mathrm{C}_r = \dfrac{n!}{r!(n-r)!}$（n 個から r 個選ぶ組合せ）
- $a$ と $b$ の指数の合計はいつも $n$

### 4. 係数を求める手順
「$(2x+1)^5$ の $x^3$ の係数」を求める：
1. 一般項：${}_5\mathrm{C}_r (2x)^{5-r} \cdot 1^r$
2. $x^3$ になるのは $5 - r = 3$ → $r = 2$
3. ${}_5\mathrm{C}_2 \times 2^3 = 10 \times 8 = 80$

**$2x$ の「2」も3乗する** のを忘れないこと。

### 5. マイナスがあるとき
$(x - 2)^4$ の $x^2$ の係数：一般項 ${}_4\mathrm{C}_r x^{4-r}(-2)^r$、$r = 2$ → ${}_4\mathrm{C}_2 \times (-2)^2 = 6 \times 4 = 24$
$(-2)^r$ は $r$ が奇数ならマイナス、偶数ならプラス。

@formulas
- $(a+b)^3 = a^3 + 3a^2b + 3ab^2 + b^3$
- 一般項 ${}_n\mathrm{C}_r \, a^{n-r} b^r$
- ${}_n\mathrm{C}_r = \dfrac{n!}{r!(n-r)!}$、${}_n\mathrm{C}_r = {}_n\mathrm{C}_{n-r}$

@pitfalls
- **係数のついた文字の係数を累乗し忘れる**：$(2x)^3 = 8x^3$
- **マイナスの符号**：$(-2)^3 = -8$
- **r と指数の対応を間違える**：$a^{n-r}b^r$
- **${}_n\mathrm{C}_r$ の計算ミス**：${}_5\mathrm{C}_2 = \frac{5 \cdot 4}{2 \cdot 1} = 10$

@example
**例題** $(x+3)^4$ の展開式における $x^2$ の係数は？

1. 一般項：${}_4\mathrm{C}_r x^{4-r} 3^r$
2. $x^2$ → $4 - r = 2$ → $r = 2$
3. ${}_4\mathrm{C}_2 \times 3^2 = 6 \times 9 = 54$

@problem n=1 type=expr ans=x^3+6*x^2+12*x+8 lv=1 calc=x^3+6x^2+12x+8
$(x+2)^3$ を展開せよ。（例：x^3+…）
@hint
$(a+b)^3 = a^3 + 3a^2b + 3ab^2 + b^3$ に $a = x$、$b = 2$。
@solution
1. $x^3 + 3 \cdot x^2 \cdot 2 + 3 \cdot x \cdot 2^2 + 2^3$
2. $= x^3 + 6x^2 + 12x + 8$
3. 答え：**$x^3 + 6x^2 + 12x + 8$**

@problem n=2 type=num ans=10 unit=- lv=1 calc=5*4/(2*1)
${}_5\mathrm{C}_2$ の値を求めよ。
@hint
$\dfrac{5 \times 4}{2 \times 1}$
@solution
1. ${}_5\mathrm{C}_2 = \dfrac{5 \times 4}{2 \times 1} = 10$
2. 答え：**10**

@problem n=3 type=num ans=80 unit=- lv=2 calc=10*2^3
$(2x+1)^5$ の展開式における $x^3$ の係数を求めよ。
@hint
一般項 ${}_5\mathrm{C}_r (2x)^{5-r} \cdot 1^r$。$x^3$ → $r = 2$。
@solution
1. $5 - r = 3$ → $r = 2$
2. ${}_5\mathrm{C}_2 \times 2^3 = 10 \times 8 = 80$
3. 答え：**80**

@problem n=4 type=num ans=-160 unit=- lv=2 calc=20*(-2)^3
$(x-2)^6$ の展開式における $x^3$ の係数を求めよ。
@hint
一般項 ${}_6\mathrm{C}_r x^{6-r}(-2)^r$。$r = 3$ なので $(-2)^3$ はマイナス。
@solution
1. $6 - r = 3$ → $r = 3$
2. ${}_6\mathrm{C}_3 = \dfrac{6 \cdot 5 \cdot 4}{3 \cdot 2 \cdot 1} = 20$
3. $20 \times (-2)^3 = 20 \times (-8) = -160$
4. 答え：**−160**

@problem n=5 type=num ans=-160 unit=- lv=3 calc=20*2^3*(-1)^3
【ボス問題】$\left(2x - \dfrac{1}{x}\right)^6$ の展開式における定数項を求めよ。
@hint
一般項 ${}_6\mathrm{C}_r (2x)^{6-r}\left(-\frac1x\right)^r$。$x$ の指数は $(6-r) - r = 6 - 2r$。これが 0 になる $r$ は？
@solution
1. 一般項：${}_6\mathrm{C}_r \, 2^{6-r} (-1)^r \, x^{6-2r}$
2. 定数項 → $6 - 2r = 0$ → $r = 3$
3. ${}_6\mathrm{C}_3 \times 2^3 \times (-1)^3 = 20 \times 8 \times (-1) = -160$
4. 答え：**−160**

@@unit math-2-08
@image
$\sin 75°$ の値は、三角定規の角度（30°、45°、60°）にはありません。でも $75° = 45° + 30°$ なので、知っている角度の組み合わせで計算できたら便利です。

それを可能にするのが **加法定理** です。「2つの角の和や差の三角関数を、それぞれの三角関数で表す」公式で、ここから2倍角の公式、半角の公式、三角関数の合成と、たくさんの公式が生まれます。いわば **三角関数の公式の親** です。

@detail
### 1. 加法定理
$$\sin(\alpha + \beta) = \sin\alpha\cos\beta + \cos\alpha\sin\beta$$
$$\cos(\alpha + \beta) = \cos\alpha\cos\beta - \sin\alpha\sin\beta$$
$$\tan(\alpha + \beta) = \frac{\tan\alpha + \tan\beta}{1 - \tan\alpha\tan\beta}$$
差のときは、$\beta$ を $-\beta$ にする（符号が変わる）：
$$\sin(\alpha - \beta) = \sin\alpha\cos\beta - \cos\alpha\sin\beta, \quad \cos(\alpha - \beta) = \cos\alpha\cos\beta + \sin\alpha\sin\beta$$
覚え方：sin は「**さいた コスモス、コスモス さいた**」（sin cos + cos sin）、cos は「**コスモス コスモス、さいた さいた**」で符号が逆。

### 2. 例：sin 75°
$$\sin 75° = \sin(45° + 30°) = \sin45°\cos30° + \cos45°\sin30°$$
$$= \frac{\sqrt2}{2}\cdot\frac{\sqrt3}{2} + \frac{\sqrt2}{2}\cdot\frac12 = \frac{\sqrt6 + \sqrt2}{4}$$

### 3. よく使う値
| 角 | 30° | 45° | 60° |
|---|---|---|---|
| sin | $\frac12$ | $\frac{\sqrt2}{2}$ | $\frac{\sqrt3}{2}$ |
| cos | $\frac{\sqrt3}{2}$ | $\frac{\sqrt2}{2}$ | $\frac12$ |
| tan | $\frac{1}{\sqrt3}$ | 1 | $\sqrt3$ |

### 4. 2倍角の公式（$\beta = \alpha$ にするだけ）
$$\sin2\alpha = 2\sin\alpha\cos\alpha$$
$$\cos2\alpha = \cos^2\alpha - \sin^2\alpha = 1 - 2\sin^2\alpha = 2\cos^2\alpha - 1$$

### 5. 三角関数の合成
$$a\sin\theta + b\cos\theta = \sqrt{a^2+b^2}\,\sin(\theta + \alpha)$$
（$\alpha$ は、点 $(a, b)$ の角度）
例：$\sin\theta + \sqrt3\cos\theta = 2\sin(\theta + 60°)$ → 最大値は 2

@formulas
- $\sin(\alpha\pm\beta) = \sin\alpha\cos\beta \pm \cos\alpha\sin\beta$
- $\cos(\alpha\pm\beta) = \cos\alpha\cos\beta \mp \sin\alpha\sin\beta$
- $\sin2\alpha = 2\sin\alpha\cos\alpha$、$\cos2\alpha = 1 - 2\sin^2\alpha$
- 合成：$a\sin\theta + b\cos\theta = \sqrt{a^2+b^2}\sin(\theta+\alpha)$

@pitfalls
- **cos の加法定理の符号**：和のときはマイナス（$\cos(\alpha+\beta) = \cos\cos - \sin\sin$）
- **$\sin(\alpha+\beta) = \sin\alpha + \sin\beta$ としてしまう**：成り立たない
- **cos が負になる象限**：$\alpha$ が鈍角なら $\cos\alpha < 0$
- **合成の角 α の取り方**：点 $(a, b)$ の偏角（sin の係数が x 座標）

@example
**例題** $\cos 15°$ の値を求めよ。

$15° = 45° - 30°$ として、
$$\cos15° = \cos45°\cos30° + \sin45°\sin30° = \frac{\sqrt2}{2}\cdot\frac{\sqrt3}{2} + \frac{\sqrt2}{2}\cdot\frac12 = \frac{\sqrt6+\sqrt2}{4}$$

@problem n=1 type=num ans=(√6+√2)/4 unit=- lv=1 calc=sin(75*π/180)
$\sin 75°$ の値を求めよ。（入力例：(√6+√2)/4）
@hint
$75° = 45° + 30°$。$\sin(\alpha+\beta) = \sin\alpha\cos\beta + \cos\alpha\sin\beta$。
@solution
1. $\sin75° = \sin45°\cos30° + \cos45°\sin30°$
2. $= \frac{\sqrt2}{2}\cdot\frac{\sqrt3}{2} + \frac{\sqrt2}{2}\cdot\frac12 = \frac{\sqrt6}{4} + \frac{\sqrt2}{4}$
3. 答え：**$\dfrac{\sqrt6+\sqrt2}{4}$**（約 0.966）

@problem n=2 type=num ans=(√6-√2)/4 unit=- lv=1 calc=cos(75*π/180)
$\cos 75°$ の値を求めよ。
@hint
$\cos(\alpha+\beta) = \cos\alpha\cos\beta - \sin\alpha\sin\beta$。和のときはマイナス。
@solution
1. $\cos75° = \cos45°\cos30° - \sin45°\sin30°$
2. $= \frac{\sqrt6}{4} - \frac{\sqrt2}{4}$
3. 答え：**$\dfrac{\sqrt6-\sqrt2}{4}$**（約 0.259）

@problem n=3 type=num ans=24/25 unit=- lv=2 calc=2*(3/5)*(4/5)
$0° < \alpha < 90°$ で $\sin\alpha = \dfrac35$ のとき、$\sin2\alpha$ の値を求めよ。
@hint
まず $\cos\alpha$ を求める（$\sin^2 + \cos^2 = 1$、第1象限なので正）。$\sin2\alpha = 2\sin\alpha\cos\alpha$。
@solution
1. $\cos^2\alpha = 1 - \frac{9}{25} = \frac{16}{25}$、$\cos\alpha > 0$ より $\cos\alpha = \frac45$
2. $\sin2\alpha = 2 \cdot \frac35 \cdot \frac45 = \frac{24}{25}$
3. 答え：**$\dfrac{24}{25}$**

@problem n=4 type=num ans=7/25 unit=- lv=2 calc=1-2*(3/5)^2
問3と同じ $\alpha$ について、$\cos2\alpha$ の値を求めよ。
@hint
$\cos2\alpha = 1 - 2\sin^2\alpha$ が速い。
@solution
1. $\cos2\alpha = 1 - 2 \cdot \left(\frac35\right)^2 = 1 - \frac{18}{25} = \frac{7}{25}$
2. 答え：**$\dfrac{7}{25}$**

@problem n=5 type=num ans=2 unit=- lv=3 calc=sqrt(1^2+(√3)^2)
【ボス問題】$y = \sin\theta + \sqrt3\cos\theta$ の最大値を求めよ。
@hint
合成：$a\sin\theta + b\cos\theta = \sqrt{a^2+b^2}\sin(\theta+\alpha)$。sin の最大値は 1。
@solution
1. $\sqrt{1^2 + (\sqrt3)^2} = \sqrt4 = 2$
2. 点 $(1, \sqrt3)$ の角は 60° → $y = 2\sin(\theta + 60°)$
3. $\sin$ の最大値は 1 なので、$y$ の最大値は **2**（$\theta = 30°$ のとき）

@@unit math-2-10
@image
「2を何回掛けたら 8 になる？」── 答えは 3 回（$2^3 = 8$）。この「何回」を表すのが **対数（log）** です。
$$\log_2 8 = 3$$
と書き、「2 を底とする 8 の対数は 3」と読みます。

対数は **掛け算を足し算に変える** 魔法の道具です。昔の人は、大きな数の掛け算を、対数表を使って足し算に直して計算していました。地震のマグニチュードや音のデシベル、そして化学の pH も、すべて対数の目盛りです。

@detail
### 1. 定義
$$a^p = M \iff p = \log_a M$$
| 指数の式 | 対数の式 |
|---|---|
| $2^3 = 8$ | $\log_2 8 = 3$ |
| $10^2 = 100$ | $\log_{10}100 = 2$ |
| $3^{-1} = \frac13$ | $\log_3 \frac13 = -1$ |
| $5^0 = 1$ | $\log_5 1 = 0$ |
「底を何乗したら真数になるか」と読み替えるのがコツ。（底 $a > 0, a \ne 1$、真数 $M > 0$）

### 2. 対数の性質
$$\log_a MN = \log_a M + \log_a N \qquad （掛け算 → 足し算）$$
$$\log_a \frac{M}{N} = \log_a M - \log_a N \qquad （割り算 → 引き算）$$
$$\log_a M^k = k\log_a M \qquad （累乗 → 掛け算）$$
例：$\log_2 12 - \log_2 3 = \log_2 \frac{12}{3} = \log_2 4 = 2$

### 3. 底の変換公式
$$\log_a b = \frac{\log_c b}{\log_c a}$$
例：$\log_4 8 = \dfrac{\log_2 8}{\log_2 4} = \dfrac32$

### 4. 常用対数（底が10）
$\log_{10}2 ≒ 0.3010$、$\log_{10}3 ≒ 0.4771$ を使うと、大きな数の桁数が分かります。
例：$2^{50}$ の桁数
$$\log_{10}2^{50} = 50 \times 0.3010 = 15.05$$
$10^{15} \le 2^{50} < 10^{16}$ なので **16 桁**。

### 5. 対数方程式
$\log_2(x-1) = 3$ → $x - 1 = 2^3 = 8$ → $x = 9$
（最初に「真数 > 0」の条件 $x > 1$ を確認）

@formulas
- $a^p = M \iff p = \log_a M$
- $\log_a MN = \log_a M + \log_a N$、$\log_a \frac MN = \log_a M - \log_a N$、$\log_a M^k = k\log_a M$
- 底の変換：$\log_a b = \dfrac{\log_c b}{\log_c a}$
- $\log_a 1 = 0$、$\log_a a = 1$

@pitfalls
- **$\log(M+N) = \log M + \log N$ としてしまう**：足し算は分けられない
- **真数条件を忘れる**：方程式の答えが真数を負にしていないか確認
- **底の変換で分子と分母を逆にする**：求めたい log の真数が分子
- **桁数の数え方**：$\log_{10}N = 15.05$ なら 16 桁（整数部分 ＋ 1）

@example
**例題** $\log_3 54 - \log_3 2$ を計算せよ。
$$\log_3 54 - \log_3 2 = \log_3 \frac{54}{2} = \log_3 27 = 3$$

@problem n=1 type=num ans=4 unit=- lv=1 calc=log(2,16)
$\log_2 16$ の値を求めよ。
@hint
2 を何乗すると 16？
@solution
1. $2^4 = 16$
2. 答え：**4**

@problem n=2 type=num ans=-2 unit=- lv=1 calc=log(3,1/9)
$\log_3 \dfrac19$ の値を求めよ。
@hint
$\frac19 = 3^{?}$
@solution
1. $\frac19 = \frac{1}{3^2} = 3^{-2}$
2. 答え：**−2**

@problem n=3 type=num ans=2 unit=- lv=2 calc=log(6,12)+log(6,3)
$\log_6 12 + \log_6 3$ を計算せよ。
@hint
足し算は真数の掛け算にまとめられる。
@solution
1. $\log_6 12 + \log_6 3 = \log_6 (12 \times 3) = \log_6 36$
2. $6^2 = 36$ → 2
3. 答え：**2**

@problem n=4 type=num ans=3/2 unit=- lv=2 calc=log(4,8)
$\log_4 8$ の値を求めよ。
@hint
底の変換で底を2に：$\dfrac{\log_2 8}{\log_2 4}$。
@solution
1. $\log_4 8 = \dfrac{\log_2 8}{\log_2 4} = \dfrac{3}{2}$
2. 答え：**$\dfrac32$**

@problem n=5 type=num ans=16 unit=桁 lv=3 calc=floor(50*0.3010)+1
【ボス問題】$2^{50}$ は何桁の整数か。$\log_{10}2 = 0.3010$ とする。
@hint
$\log_{10}2^{50} = 50\log_{10}2$ を計算。$\log_{10}N$ の整数部分が $k$ なら、$N$ は $k+1$ 桁。
@solution
1. $\log_{10}2^{50} = 50 \times 0.3010 = 15.05$
2. $15 \le 15.05 < 16$ より $10^{15} \le 2^{50} < 10^{16}$
3. $10^{15}$ は 16 桁の最小の数なので、$2^{50}$ は **16 桁**

@@unit math-2-11
@image
坂道の **傾き** を考えます。まっすぐな坂なら傾きは1つですが、山道のように曲がった坂では、場所によって傾きが変わります。

**微分** は、**曲線のある1点での傾き（瞬間の変化の割合）** を求める方法です。車のスピードメーターが表示するのも「その瞬間の速さ」── これも微分の考え方です。

関数 $y = x^2$ のグラフ上の各点での傾きを表す新しい関数を **導関数** $y'$ と呼び、驚くほど簡単なルールで求められます。

@detail
### 1. 平均変化率（2点を結ぶ直線の傾き）
$x$ が $a$ から $b$ まで変わるとき：
$$\frac{f(b) - f(a)}{b - a}$$
例：$f(x) = x^2$、$x$ が 1 から 3 → $\dfrac{9 - 1}{3 - 1} = 4$

### 2. 微分係数（1点での傾き）
2点目を限りなく近づける（$h \to 0$）：
$$f'(a) = \lim_{h \to 0} \frac{f(a+h) - f(a)}{h}$$
$f(x) = x^2$、$a = 1$ のとき：
$$\frac{(1+h)^2 - 1}{h} = \frac{2h + h^2}{h} = 2 + h \;\to\; 2 \quad (h \to 0)$$
| h | 1 | 0.1 | 0.01 | 0.001 |
|---|---|---|---|---|
| 2 + h | 3 | 2.1 | 2.01 | 2.001 |
→ どんどん 2 に近づく。だから点 $(1, 1)$ での傾きは 2。

### 3. 導関数の公式
$$(x^n)' = nx^{n-1} \qquad （c)' = 0 \qquad （定数倍・和はそのまま）$$
「**指数を前に下ろして、指数を1つ減らす**」
| 関数 | 導関数 |
|---|---|
| $x^3$ | $3x^2$ |
| $x^2$ | $2x$ |
| $x$ | 1 |
| 5（定数） | 0 |
例：$y = 2x^3 - 4x^2 + 3x - 1$ → $y' = 6x^2 - 8x + 3$

### 4. 接線の方程式
曲線 $y = f(x)$ 上の点 $(a, f(a))$ における接線：
$$y - f(a) = f'(a)(x - a)$$
例：$y = x^2$ の点 $(1, 1)$ の接線 → 傾き $f'(1) = 2$
$$y - 1 = 2(x - 1) \;\Rightarrow\; y = 2x - 1$$

@formulas
- 平均変化率 $\dfrac{f(b)-f(a)}{b-a}$
- 微分係数 $f'(a) = \lim\limits_{h\to0}\dfrac{f(a+h)-f(a)}{h}$
- $(x^n)' = nx^{n-1}$、$(c)' = 0$
- 接線 $y - f(a) = f'(a)(x-a)$

@pitfalls
- **定数項を微分しても残す**：定数の微分は 0
- **指数を1つ減らし忘れる**：$(x^3)' = 3x^2$（$3x^3$ ではない）
- **接線の傾きに $f(a)$ を使う**：傾きは $f'(a)$
- **接点の y 座標の計算忘れ**：$f(a)$ は元の関数に代入

@example
**例題** $f(x) = x^3 - 3x$ の、$x = 2$ における微分係数を求めよ。
1. $f'(x) = 3x^2 - 3$
2. $f'(2) = 3 \cdot 4 - 3 = 9$

@problem n=1 type=expr ans=6*x^2-8*x+3 lv=1 calc=6x^2-8x+3
$y = 2x^3 - 4x^2 + 3x - 1$ を微分せよ。（$y'$ を入力。例：6x^2-…）
@hint
各項ごとに「指数を前に下ろして1つ減らす」。定数は 0。
@solution
1. $(2x^3)' = 6x^2$
2. $(-4x^2)' = -8x$
3. $(3x)' = 3$、$(-1)' = 0$
4. 答え：**$y' = 6x^2 - 8x + 3$**

@problem n=2 type=num ans=4 unit=- lv=1 calc=(3^2-1^2)/(3-1)
関数 $f(x) = x^2$ について、$x$ が 1 から 3 まで変わるときの平均変化率を求めよ。
@hint
$\dfrac{f(3) - f(1)}{3 - 1}$
@solution
1. $f(3) = 9$、$f(1) = 1$
2. $\dfrac{9 - 1}{2} = 4$
3. 答え：**4**

@problem n=3 type=num ans=9 unit=- lv=2 calc=3*2^2-3
$f(x) = x^3 - 3x$ について、$f'(2)$ を求めよ。
@hint
まず $f'(x)$ を求めてから $x = 2$ を代入。
@solution
1. $f'(x) = 3x^2 - 3$
2. $f'(2) = 12 - 3 = 9$
3. 答え：**9**

@problem n=4 type=expr ans=4*x-4 lv=2 calc=4x-4
曲線 $y = x^2$ 上の点 $(2, 4)$ における接線の方程式を $y = \cdots$ の形で求め、右辺を入力せよ。
@hint
傾きは $y' = 2x$ に $x = 2$。$y - 4 = (傾き)(x - 2)$。
@solution
1. $y' = 2x$ → 傾き $2 \times 2 = 4$
2. $y - 4 = 4(x - 2)$
3. $y = 4x - 4$
4. 答え：**$y = 4x - 4$**

@problem n=5 type=expr ans=3*x-2 lv=3 calc=3x-2
【ボス問題】曲線 $y = x^3$ の接線のうち、点 $(0, -2)$ を通るものを求め、$y = \cdots$ の右辺を入力せよ。
@hint
接点を $(t, t^3)$ とおく。接線は $y - t^3 = 3t^2(x - t)$。これが $(0, -2)$ を通る条件から $t$ を求める。
@solution
1. 接点 $(t, t^3)$、傾き $3t^2$ → 接線 $y = 3t^2x - 2t^3$
2. $(0, -2)$ を通る：$-2 = -2t^3$ → $t^3 = 1$ → $t = 1$
3. 接線：$y = 3x - 2$
4. 答え：**$y = 3x - 2$**
（「曲線上の点の接線」ではなく「外の点を通る接線」は、接点を文字でおくのが定石）

@@unit math-2-13
@image
**積分** は、微分の「逆」の計算です。そして、グラフで囲まれた部分の **面積** を求める道具になります。

長方形や三角形の面積は公式で求められますが、放物線で囲まれた部分は？ 細い長方形にたくさん切って足し合わせれば、だいたいの面積が出ます。この「細かく切って足す」を極限まで細かくしたのが積分です。

そしてすごいことに、その面積は **「微分すると元の関数になる関数」に、端の値を代入して引くだけ** で求まります。

@detail
### 1. 不定積分（微分の逆）
$F'(x) = f(x)$ のとき、$F(x)$ を $f(x)$ の不定積分といい、
$$\int f(x)\,dx = F(x) + C \qquad （C は積分定数）$$
$$\int x^n dx = \frac{x^{n+1}}{n+1} + C$$
「**指数を1つ増やして、その数で割る**」（微分の逆の操作）
| 関数 | 不定積分 |
|---|---|
| $x^2$ | $\frac13x^3 + C$ |
| $x$ | $\frac12x^2 + C$ |
| 1 | $x + C$ |

### 2. 定積分
$$\int_a^b f(x)\,dx = \Big[F(x)\Big]_a^b = F(b) - F(a)$$
例：$\displaystyle\int_0^3 x^2 dx = \left[\frac{x^3}{3}\right]_0^3 = 9 - 0 = 9$

### 3. 面積
$a \le x \le b$ で $f(x) \ge 0$ なら、グラフと $x$ 軸の間の面積は
$$S = \int_a^b f(x)\,dx$$
2つのグラフの間（上が $f$、下が $g$）なら
$$S = \int_a^b \{f(x) - g(x)\}\,dx \qquad （上 − 下）$$

### 4. 例：放物線と直線で囲まれた面積
$y = x^2$ と $y = x + 2$ で囲まれた部分：
1. 交点：$x^2 = x + 2$ → $x = -1, 2$
2. 間では直線が上
3. $\displaystyle S = \int_{-1}^{2}(x + 2 - x^2)\,dx = \left[\frac{x^2}{2} + 2x - \frac{x^3}{3}\right]_{-1}^{2} = \frac92$

### 5. 便利な公式（$\frac16$ 公式）
$$\int_\alpha^\beta (x-\alpha)(x-\beta)\,dx = -\frac{1}{6}(\beta-\alpha)^3$$
放物線と直線で囲まれた面積は $\dfrac{|a|}{6}(\beta - \alpha)^3$（$a$ は $x^2$ の係数の差）。上の例：$\frac16 \times 3^3 = \frac92$ ✓

@formulas
- $\int x^n dx = \dfrac{x^{n+1}}{n+1} + C$
- $\int_a^b f(x)dx = F(b) - F(a)$
- 面積 $S = \int_a^b (上 - 下)\,dx$
- $\frac16$ 公式：$\int_\alpha^\beta (x-\alpha)(x-\beta)dx = -\frac16(\beta-\alpha)^3$

@pitfalls
- **積分で割るのを忘れる**：$\int x^2 dx = \frac{x^3}{3}$（$x^3$ ではない）
- **下端の代入を引き忘れる**：$F(b) - F(a)$
- **x 軸より下の部分を面積にそのまま足す**：下側はマイナスになるので符号を変える
- **上下を逆に引く**：面積は「上 − 下」

@example
**例題** 放物線 $y = -x^2 + 4$ と $x$ 軸で囲まれた部分の面積は？
1. $x$ 軸との交点：$-x^2 + 4 = 0$ → $x = \pm2$
2. $\displaystyle S = \int_{-2}^{2}(-x^2 + 4)dx = \left[-\frac{x^3}{3} + 4x\right]_{-2}^{2} = \left(-\frac83 + 8\right) - \left(\frac83 - 8\right) = \frac{32}{3}$

@problem n=1 type=expr ans=x^3/3+x^2 lv=1 calc=x^3/3+x^2
$\displaystyle\int (x^2 + 2x)\,dx$ を求めよ（積分定数 $C$ は省略して入力）。
@hint
$\int x^2 dx = \frac{x^3}{3}$、$\int 2x\,dx = x^2$。
@solution
1. $\int x^2 dx = \frac13x^3$
2. $\int 2x\,dx = 2 \cdot \frac12x^2 = x^2$
3. 答え：**$\dfrac13x^3 + x^2 + C$**

@problem n=2 type=num ans=9 unit=- lv=1 calc=3^3/3
$\displaystyle\int_0^3 x^2\,dx$ を求めよ。
@hint
$\left[\frac{x^3}{3}\right]_0^3$
@solution
1. $\left[\frac{x^3}{3}\right]_0^3 = \frac{27}{3} - 0 = 9$
2. 答え：**9**

@problem n=3 type=num ans=10 unit=- lv=2 calc=(2^3+2^2)-(1^3+1^2)
$\displaystyle\int_1^2 (3x^2 + 2x)\,dx$ を求めよ。
@hint
$\left[x^3 + x^2\right]_1^2$
@solution
1. 不定積分：$x^3 + x^2$
2. $(8 + 4) - (1 + 1) = 12 - 2 = 10$
3. 答え：**10**

@problem n=4 type=num ans=32/3 unit=- lv=2 calc=(-8/3+8)-(8/3-8)
放物線 $y = -x^2 + 4$ と $x$ 軸で囲まれた部分の面積を求めよ。
@hint
$x$ 軸との交点は $x = \pm2$。$\int_{-2}^{2}(-x^2+4)dx$。
@solution
1. 交点：$x = -2, 2$
2. $\left[-\frac{x^3}{3} + 4x\right]_{-2}^{2} = \frac{16}{3} - \left(-\frac{16}{3}\right) = \frac{32}{3}$
3. 答え：**$\dfrac{32}{3}$**

@problem n=5 type=num ans=9/2 unit=- lv=3 calc=3^3/6
【ボス問題】放物線 $y = x^2$ と直線 $y = x + 2$ で囲まれた部分の面積を求めよ。
@hint
交点の $x$ 座標は $x^2 = x + 2$ を解いて $-1, 2$。直線が上。$\frac16$ 公式も使える。
@solution
1. 交点：$x^2 - x - 2 = 0$ → $(x+1)(x-2) = 0$ → $x = -1, 2$
2. 面積：$\int_{-1}^{2}(x + 2 - x^2)dx = -\int_{-1}^{2}(x+1)(x-2)dx$
3. $\frac16$ 公式：$\frac16(2-(-1))^3 = \frac{27}{6} = \frac92$
4. 答え：**$\dfrac92$**

@@unit math-b-01
@image
「2, 5, 8, 11, 14, …」のように、決まったルールで並んだ数の列を **数列** と呼びます。

- **等差数列**：毎回 **同じ数を足す**（階段を一定の高さずつ上がる）
- **等比数列**：毎回 **同じ数を掛ける**（ねずみ算・複利の貯金・細胞分裂）

「100番目の数は？」「1番目から100番目まで足すと？」を、全部書き出さずに一発で求めるのがこの単元です。ガウスが小学生のとき、1から100までの和を一瞬で求めた話が有名です。

@detail
### 1. 等差数列
初項 $a$、公差 $d$（毎回足す数）。
| 項 | 1 | 2 | 3 | … | n |
|---|---|---|---|---|---|
| 値 | $a$ | $a+d$ | $a+2d$ | … | $a+(n-1)d$ |
$$a_n = a + (n-1)d$$
例：2, 5, 8, … → $a = 2$、$d = 3$ → $a_{10} = 2 + 9 \times 3 = 29$

### 2. 等差数列の和（ガウスの方法）
1 + 2 + … + 100 を、逆順に並べて足すと：
| | 1 | 2 | … | 100 |
|---|---|---|---|---|
| 逆順 | 100 | 99 | … | 1 |
| 合計 | 101 | 101 | … | 101 |
101 が 100 個で 10100、これは2倍なので 5050。一般に：
$$S_n = \frac{n(a_1 + a_n)}{2} = \frac{n\{2a + (n-1)d\}}{2}$$
「（初項 ＋ 末項）× 個数 ÷ 2」

### 3. 等比数列
初項 $a$、公比 $r$（毎回掛ける数）。
$$a_n = ar^{n-1}$$
例：3, 6, 12, 24, … → $a = 3$、$r = 2$ → $a_6 = 3 \times 2^5 = 96$

### 4. 等比数列の和
$$S_n = \frac{a(r^n - 1)}{r - 1} \qquad (r \ne 1)$$
例：1 + 2 + 4 + … + $2^9$（10項）→ $\dfrac{1 \times (2^{10} - 1)}{2 - 1} = 1023$

### 5. 見分け方
| 隣との関係 | 数列 |
|---|---|
| 引き算（差）が一定 | 等差数列 |
| 割り算（比）が一定 | 等比数列 |

@formulas
- 等差：$a_n = a + (n-1)d$、$S_n = \dfrac{n(a_1+a_n)}{2}$
- 等比：$a_n = ar^{n-1}$、$S_n = \dfrac{a(r^n-1)}{r-1}$
- $1 + 2 + \cdots + n = \dfrac{n(n+1)}{2}$

@pitfalls
- **$n-1$ を $n$ にしてしまう**：第 $n$ 項は公差を $n-1$ 回足す
- **等比の $r^{n-1}$ を $r^n$ にする**
- **項数の数え間違い**：3 から 99 までの奇数は $\frac{99-3}{2}+1 = 49$ 個
- **等比数列の和で $r = 1$ の場合**：そのときは $S_n = na$

@example
**例題** 等差数列 5, 9, 13, … の第20項と、初項から第20項までの和は？
1. $a = 5$、$d = 4$ → $a_{20} = 5 + 19 \times 4 = 81$
2. $S_{20} = \dfrac{20(5 + 81)}{2} = 860$

@problem n=1 type=num ans=29 unit=- lv=1 calc=2+9*3
等差数列 2, 5, 8, … の第10項を求めよ。
@hint
$a = 2$、$d = 3$、$a_{10} = a + 9d$。
@solution
1. $a_{10} = 2 + (10-1) \times 3 = 2 + 27 = 29$
2. 答え：**29**

@problem n=2 type=num ans=5050 unit=- lv=1 calc=100*101/2
1 から 100 までの自然数の和を求めよ。
@hint
$\dfrac{n(n+1)}{2}$、または（初項＋末項）×個数÷2。
@solution
1. $\dfrac{100 \times 101}{2} = 5050$
2. 答え：**5050**

@problem n=3 type=num ans=96 unit=- lv=1 calc=3*2^5
等比数列 3, 6, 12, … の第6項を求めよ。
@hint
$a = 3$、$r = 2$、$a_6 = ar^5$。
@solution
1. $a_6 = 3 \times 2^{5} = 3 \times 32 = 96$
2. 答え：**96**

@problem n=4 type=num ans=1023 unit=- lv=2 calc=(2^10-1)/(2-1)
1 + 2 + 4 + 8 + … + 512 を求めよ。
@hint
初項 1、公比 2 の等比数列。512 ＝ $2^9$ なので項数は 10。
@solution
1. $512 = 2^9$ → 第10項 → 項数 10
2. $S_{10} = \dfrac{1 \times (2^{10} - 1)}{2 - 1} = 1024 - 1 = 1023$
3. 答え：**1023**

@problem n=5 type=num ans=2499 unit=- lv=3 calc=49*(3+99)/2
【ボス問題】3 から 99 までの奇数の和を求めよ。
@hint
初項 3、公差 2 の等差数列。項数は $\frac{99 - 3}{2} + 1$。
@solution
1. 項数：$\dfrac{99-3}{2} + 1 = 48 + 1 = 49$
2. 和：$\dfrac{49 \times (3 + 99)}{2} = \dfrac{49 \times 102}{2} = 49 \times 51 = 2499$
3. 答え：**2499**
（1 から 99 の奇数の和は $50^2 = 2500$。そこから 1 を引いても 2499 ✓）

@@unit math-c-01
@image
**ベクトル** は「**向きと大きさをもった矢印**」です。

「東に 3 km、北に 4 km 歩いた」とき、出発点から見た移動は「北東寄りに 5 km」の矢印1本で表せます。この矢印がベクトル。物理の速度や力もベクトルです。

ベクトルを使うと、図形の問題を **計算で** 解けるようになります。特に **内積** は「2本の矢印がどれだけ同じ向きを向いているか」を表す数で、角度や垂直の判定に大活躍します。

@detail
### 1. 成分で表す
$\vec{a} = (a_1, a_2)$：右に $a_1$、上に $a_2$ 進む矢印。
- 大きさ（長さ）：$|\vec{a}| = \sqrt{a_1^2 + a_2^2}$（三平方の定理）
- 足し算：$(a_1, a_2) + (b_1, b_2) = (a_1+b_1, a_2+b_2)$
- 実数倍：$k(a_1, a_2) = (ka_1, ka_2)$
例：$\vec a = (3, 4)$ → $|\vec a| = \sqrt{9+16} = 5$

### 2. 内積の定義
$$\vec{a}\cdot\vec{b} = |\vec{a}||\vec{b}|\cos\theta \qquad （θ は2つの矢印のなす角）$$
| θ | cos θ | 内積 |
|---|---|---|
| 0°（同じ向き） | 1 | 最大（長さの積） |
| 90°（垂直） | 0 | **0** |
| 180°（逆向き） | −1 | マイナス |

### 3. 成分での内積
$$\vec{a}\cdot\vec{b} = a_1b_1 + a_2b_2$$
例：$\vec a = (1, 2)$、$\vec b = (3, -1)$ → $1 \times 3 + 2 \times (-1) = 1$

### 4. なす角を求める
$$\cos\theta = \frac{\vec a \cdot \vec b}{|\vec a||\vec b|}$$
例：$\vec a = (1, 0)$、$\vec b = (1, 1)$ → $\cos\theta = \dfrac{1}{1 \times \sqrt2} = \dfrac{1}{\sqrt2}$ → $\theta = 45°$

### 5. 垂直の条件
$$\vec a \perp \vec b \iff \vec a \cdot \vec b = 0$$
例：$(2, k)$ と $(3, -6)$ が垂直 → $6 - 6k = 0$ → $k = 1$

### 6. 大きさと内積
$$|\vec a + \vec b|^2 = |\vec a|^2 + 2\vec a\cdot\vec b + |\vec b|^2$$
（$(a+b)^2$ の展開と同じ形）

@formulas
- $|\vec a| = \sqrt{a_1^2+a_2^2}$
- $\vec a\cdot\vec b = |\vec a||\vec b|\cos\theta = a_1b_1 + a_2b_2$
- $\cos\theta = \dfrac{\vec a\cdot\vec b}{|\vec a||\vec b|}$
- 垂直 ⇔ 内積 ＝ 0

@pitfalls
- **内積をベクトルだと思う**：内積は **数**（スカラー）
- **成分の内積で掛ける組を間違える**：x どうし、y どうし
- **なす角は 0°〜180°**：$\cos\theta < 0$ なら鈍角
- **$|\vec a + \vec b| = |\vec a| + |\vec b|$ としてしまう**：一般には成り立たない

@example
**例題** $\vec a = (2, 1)$、$\vec b = (1, 3)$ のなす角 θ は？
1. 内積：$2 \times 1 + 1 \times 3 = 5$
2. $|\vec a| = \sqrt5$、$|\vec b| = \sqrt{10}$
3. $\cos\theta = \dfrac{5}{\sqrt5 \times \sqrt{10}} = \dfrac{5}{\sqrt{50}} = \dfrac{1}{\sqrt2}$ → $\theta = 45°$

@problem n=1 type=num ans=13 unit=- lv=1 calc=sqrt(5^2+12^2)
$\vec a = (5, 12)$ の大きさ $|\vec a|$ を求めよ。
@hint
$\sqrt{5^2 + 12^2}$
@solution
1. $\sqrt{25 + 144} = \sqrt{169} = 13$
2. 答え：**13**

@problem n=2 type=num ans=1 unit=- lv=1 calc=1*3+2*(-1)
$\vec a = (1, 2)$、$\vec b = (3, -1)$ のとき、内積 $\vec a\cdot\vec b$ を求めよ。
@hint
x どうし、y どうしを掛けて足す。
@solution
1. $1 \times 3 + 2 \times (-1) = 3 - 2 = 1$
2. 答え：**1**

@problem n=3 type=num ans=1 unit=- lv=2 calc=6/6
$\vec a = (2, k)$ と $\vec b = (3, -6)$ が垂直になるような $k$ の値を求めよ。
@hint
垂直 ⇔ 内積 ＝ 0。
@solution
1. $2 \times 3 + k \times (-6) = 0$
2. $6 - 6k = 0$ → $k = 1$
3. 答え：**1**

@problem n=4 type=num ans=45 unit=° lv=2 calc=acos(5/(sqrt(5)*sqrt(10)))*180/π
$\vec a = (2, 1)$、$\vec b = (1, 3)$ のなす角 θ は何度か。（度数で数値を入力）
@hint
$\cos\theta = \dfrac{\vec a\cdot\vec b}{|\vec a||\vec b|}$
@solution
1. 内積 5、$|\vec a| = \sqrt5$、$|\vec b| = \sqrt{10}$
2. $\cos\theta = \dfrac{5}{\sqrt{50}} = \dfrac{1}{\sqrt2}$
3. $\theta = 45°$
4. 答え：**45**

@problem n=5 type=num ans=√19 unit=- lv=3 calc=sqrt(4+2*3+9)
【ボス問題】$|\vec a| = 2$、$|\vec b| = 3$、$\vec a\cdot\vec b = 3$ のとき、$|\vec a + \vec b|$ を求めよ。（入力例：√19）
@hint
$|\vec a + \vec b|^2 = |\vec a|^2 + 2\vec a\cdot\vec b + |\vec b|^2$ を計算して、最後に平方根。
@solution
1. $|\vec a + \vec b|^2 = 4 + 2 \times 3 + 9 = 19$
2. $|\vec a + \vec b| = \sqrt{19}$
3. 答え：**$\sqrt{19}$**

@@unit math-3-03
@image
数学Ⅱでは $x^n$ のような「多項式」だけを微分しました。数学Ⅲでは、**どんな関数でも微分できる** ようになります。

ポイントは3つの道具です。
- **積の微分**：掛け算になっている関数
- **商の微分**：割り算（分数）になっている関数
- **合成関数の微分**：関数の中に関数が入っている（$(2x+1)^5$、$\sin 3x$ など）。**「外側を微分 × 中身を微分」**

この3つと、$\sin x$、$e^x$、$\log x$ の微分を組み合わせれば、ほとんどの関数が微分できます。

@detail
### 1. 積の微分
$$\{f(x)g(x)\}' = f'(x)g(x) + f(x)g'(x)$$
「前を微分×後ろそのまま ＋ 前そのまま×後ろを微分」
例：$y = x^2\sin x$ → $y' = 2x\sin x + x^2\cos x$

### 2. 商の微分
$$\left\{\frac{f(x)}{g(x)}\right\}' = \frac{f'(x)g(x) - f(x)g'(x)}{\{g(x)\}^2}$$
「（分子を微分×分母 − 分子×分母を微分）÷ 分母の2乗」
例：$y = \dfrac{x}{x+1}$ → $y' = \dfrac{1 \cdot (x+1) - x \cdot 1}{(x+1)^2} = \dfrac{1}{(x+1)^2}$

### 3. 合成関数の微分
$$\{f(g(x))\}' = f'(g(x)) \cdot g'(x)$$
「**外側を微分（中身はそのまま）× 中身を微分**」
例：$y = (2x+1)^5$
| ステップ | 結果 |
|---|---|
| 外側 $(\;)^5$ を微分 | $5(2x+1)^4$ |
| 中身 $2x+1$ を微分 | $2$ |
| 掛ける | $10(2x+1)^4$ |

### 4. いろいろな関数の導関数
| 関数 | 導関数 |
|---|---|
| $\sin x$ | $\cos x$ |
| $\cos x$ | $-\sin x$ |
| $\tan x$ | $\dfrac{1}{\cos^2 x}$ |
| $e^x$ | $e^x$（そのまま！） |
| $\log x$ | $\dfrac1x$ |
| $x^r$（r は実数） | $rx^{r-1}$ （例：$\sqrt x = x^{1/2}$ → $\frac{1}{2\sqrt x}$） |

### 5. 組み合わせの例
- $y = \sin 3x$ → $y' = \cos 3x \times 3 = 3\cos3x$
- $y = e^{2x}$ → $y' = e^{2x} \times 2 = 2e^{2x}$
- $y = \log(x^2+1)$ → $y' = \dfrac{1}{x^2+1} \times 2x = \dfrac{2x}{x^2+1}$

@formulas
- 積：$(fg)' = f'g + fg'$
- 商：$\left(\dfrac fg\right)' = \dfrac{f'g - fg'}{g^2}$
- 合成：$\{f(g(x))\}' = f'(g(x))g'(x)$
- $(\sin x)' = \cos x$、$(\cos x)' = -\sin x$、$(e^x)' = e^x$、$(\log x)' = \frac1x$

@pitfalls
- **合成関数で中身の微分を掛け忘れる**：$(\sin3x)' = 3\cos3x$
- **商の微分の分子の順番**：$f'g - fg'$（逆にすると符号が反対）
- **$(\cos x)'$ の符号**：$-\sin x$
- **$\log$ の底**：数学Ⅲの $\log x$ は自然対数（底 $e$）

@example
**例題** $y = x e^{x}$ を微分せよ。
積の微分：$y' = 1 \cdot e^x + x \cdot e^x = (x+1)e^x$

@problem n=1 type=expr ans=2*x*sin(x)+x^2*cos(x) lv=1 calc=2x*sin(x)+x^2*cos(x)
$y = x^2\sin x$ を微分せよ。（入力例：2x*sin(x)+…）
@hint
積の微分：$(x^2)'\sin x + x^2(\sin x)'$。
@solution
1. $(x^2)' = 2x$、$(\sin x)' = \cos x$
2. $y' = 2x\sin x + x^2\cos x$
3. 答え：**$2x\sin x + x^2\cos x$**

@problem n=2 type=expr ans=10*(2*x+1)^4 lv=1 calc=10(2x+1)^4
$y = (2x+1)^5$ を微分せよ。
@hint
外側を微分 $5(2x+1)^4$ × 中身を微分 $2$。
@solution
1. 外側：$5(2x+1)^4$
2. 中身：$(2x+1)' = 2$
3. $y' = 10(2x+1)^4$
4. 答え：**$10(2x+1)^4$**

@problem n=3 type=expr ans=1/(x+1)^2 lv=2 calc=1/(x+1)^2
$y = \dfrac{x}{x+1}$ を微分せよ。
@hint
商の微分：$\dfrac{(x)'(x+1) - x(x+1)'}{(x+1)^2}$。
@solution
1. 分子：$1 \cdot (x+1) - x \cdot 1 = 1$
2. $y' = \dfrac{1}{(x+1)^2}$
3. 答え：**$\dfrac{1}{(x+1)^2}$**

@problem n=4 type=expr ans=2*x/(x^2+1) lv=2 calc=2x/(x^2+1)
$y = \log(x^2+1)$ を微分せよ（$\log$ は自然対数）。
@hint
$(\log u)' = \dfrac{1}{u} \times u'$。中身 $u = x^2 + 1$ を微分すると $2x$。
@solution
1. 外側：$\dfrac{1}{x^2+1}$
2. 中身：$(x^2+1)' = 2x$
3. $y' = \dfrac{2x}{x^2+1}$
4. 答え：**$\dfrac{2x}{x^2+1}$**

@problem n=5 type=expr ans=e^(2*x)*(2*sin(x)+cos(x)) lv=3 calc=e^(2x)(2sin(x)+cos(x))
【ボス問題】$y = e^{2x}\sin x$ を微分せよ。（入力例：e^(2x)*(…)）
@hint
積の微分。$(e^{2x})' = 2e^{2x}$（合成関数）、$(\sin x)' = \cos x$。
@solution
1. $(e^{2x})' = e^{2x} \times 2 = 2e^{2x}$
2. $y' = 2e^{2x}\sin x + e^{2x}\cos x$
3. $= e^{2x}(2\sin x + \cos x)$
4. 答え：**$e^{2x}(2\sin x + \cos x)$**
