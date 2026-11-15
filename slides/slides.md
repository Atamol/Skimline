---
theme: default
title: Skimline
colorSchema: dark
fonts:
  sans: Noto Sans JP
layout: cover
---

# Skimline

着陸日がズレても使える地点はどこか

<div class="abs-bl m-10 text-sm opacity-70">NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator</div>

---

## 課題: 着陸日はズレる

```mermaid {theme: 'dark', scale: 0.95}
flowchart LR
  A[着陸日がズレる] --> B[電力はあるか<br>太陽が見えるか]
  A --> C[通信できるか<br>地球が見えるか]
  B --> D[1地点，1日付<br>ずつ調べ直し]
  C --> D
```

- Horizons，Quickmap，Moon Trekで調べられるのは1件ずつ
- 日程が動いたら，候補をまとめて見比べたい

---

## 原理: 決め手は稜線

- 電力も通信も，天体が**稜線より上**にあるかで決まる
- 南極では<span class="sun">太陽</span>も<span class="earth">地球</span>も地平線すれすれで，数日，数kmズレるだけで結果が変わる

<img src="/sky.png" class="mt-6 mx-auto w-190">

---

## 方法: 3段で合否を出す

```mermaid {theme: 'dark', scale: 0.85}
flowchart LR
  H[1. 太陽と地球の位置<br>JPL Horizons] --> J{3. 稜線より<br>上にあるか}
  L[2. 稜線<br>LRO LOLAの標高] --> J
  J --> P[電力]
  J --> E[通信]
  P --> G[要件と比べて<br>成立か不成立か]
  E --> G
```

<img src="/timeline.png" class="mt-4 mx-auto w-120">

---

## 解決案: 地点 × 着陸日の表

<img src="/slip.png" class="mx-auto">

- 1マスが着陸時刻1つ分で，緑が成立
- 同じ尾根でも約10日は<span class="go">成立</span>，その後2週間は地球が見えない

---

## 解決案: 選んだマスの空

<div class="grid grid-cols-[2fr_3fr] gap-6 items-center">
<div>

- 稜線と，<span class="sun">太陽</span>と<span class="earth">地球</span>の通り道
- 日没と地球没までの残り時間
- 2地点を上下に比較

</div>
<img src="/sky2.png">
</div>

---

## 計算は合っているか

<div class="grid grid-cols-4 gap-4 text-center text-sm my-10">
<div><div class="text-4xl go mb-3">0.006度</div>JPL Horizonsとの最大の差<br>(太陽の直径は0.53度)</div>
<div><div class="text-4xl go mb-3">348時間</div>Blue Ghost Mission 1の日没まで<br>(報告は346時間)</div>
<div><div class="text-4xl go mb-3">1月26日</div>SLIMの出力が半分に戻る日<br>(運用再開は1月28日)</div>
<div><div class="text-4xl go mb-3">85%</div>Connecting ridgeの日照率<br>(かぐやの観測は最良の地表で86%)</div>
</div>

- データ: NASA (JPL Horizons，LRO LOLA)，JAXA (SLIM，かぐや)
- 未対応: 南緯82度より北の地形，地上局，温度，塵
