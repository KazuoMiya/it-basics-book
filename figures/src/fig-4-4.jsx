export default () => {
  const ink = 'var(--cds-text-primary)', quiet = 'var(--cds-text-secondary)', edge = 'var(--cds-chart-axis)', accent = 'var(--cds-chart-categorical-1)';
  const pos = { 50: [380, 104], 30: [230, 184], 70: [530, 184], 20: [155, 264], 40: [305, 264], 60: [455, 264], 80: [605, 264] };
  const path = [50, 70, 60];
  const link = (a, b) => { const hi = path.includes(a) && path.includes(b); const dx = pos[b][0] - pos[a][0], dy = pos[b][1] - pos[a][1], d = Math.sqrt(dx * dx + dy * dy), ux = dx / d * 22, uy = dy / d * 22; return <line key={a + '-' + b} x1={(pos[a][0] + ux).toFixed(1)} y1={(pos[a][1] + uy).toFixed(1)} x2={(pos[b][0] - ux).toFixed(1)} y2={(pos[b][1] - uy).toFixed(1)} stroke={hi ? accent : edge} strokeWidth={hi ? 2.5 : 1.25}/>; };
  const node = v => { const hi = path.includes(v); return <g key={v}><circle cx={pos[v][0]} cy={pos[v][1]} r='22' fill={hi ? accent : 'none'} fillOpacity={hi ? 0.12 : 1} stroke={hi ? accent : edge} strokeWidth={hi ? 2 : 1.25}/><text x={pos[v][0]} y={pos[v][1] + 5} textAnchor='middle' fontSize='15' fontWeight='600' fill={ink}>{v}</text></g>; };
  return <svg viewBox='0 0 760 364' role='img' aria-label='二分探索木では、どの節でも左の子孫は自分より小さく、右の子孫は自分より大きい。60を探すときは50、70、60の順に3回比べる' fontSize='13'>
    <text data-claude-text-id='title' x='24' y='34' fontSize='15' fontWeight='600' fill={ink}>二分探索木では、左の子孫は自分より小さく、右の子孫は自分より大きい</text>
    <text data-claude-text-id='key' x='24' y='56' fontSize='11.5' fill={quiet}>色付きの節は、60を探すときに通る道筋</text>
    <g data-claude-anchor='links'>{link(50, 30)}{link(50, 70)}{link(30, 20)}{link(30, 40)}{link(70, 60)}{link(70, 80)}</g>
    <g data-claude-anchor='nodes'>{[50, 30, 70, 20, 40, 60, 80].map(node)}</g>
    <g data-claude-anchor='labels' fontSize='12'>
      <text data-claude-text-id='root' x='348' y='100' textAnchor='end' fill={quiet}>根</text>
      <text data-claude-text-id='leaf' x='123' y='269' textAnchor='end' fill={quiet}>葉</text>
      <text data-claude-text-id='s1' x='412' y='100' fill={ink}>① 60は50より大きい → 右へ</text>
      <text data-claude-text-id='s2' x='562' y='180' fill={ink}>② 60は70より小さい → 左へ</text>
      <text data-claude-text-id='s3' x='455' y='308' textAnchor='middle' fill={ink}>③ 見つかった</text>
    </g>
    <text data-claude-text-id='note' x='24' y='344' fontSize='12' fill={ink}>左→自分→右の順（間順）ですべての節をたどると、20、30、40、50、60、70、80と小さい順に並ぶ</text>
  </svg>;
};
