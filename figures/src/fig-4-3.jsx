export default () => {
  const ink = 'var(--cds-text-primary)', quiet = 'var(--cds-text-secondary)', edge = 'var(--cds-chart-axis)', accent = 'var(--cds-chart-categorical-1)';
  const cell = (x, y, name, hi) => <g>
    <rect x={x} y={y} width='96' height='44' rx='6' fill={hi ? accent : 'none'} fillOpacity={hi ? 0.12 : 1} stroke={hi ? accent : edge} strokeWidth={hi ? 2 : 1.25}/>
    <line x1={x + 60} x2={x + 60} y1={y} y2={y + 44} stroke={hi ? accent : edge} strokeWidth='1.25'/>
    <text x={x + 30} y={y + 27} textAnchor='middle' fontSize='15' fontWeight='600' fill={ink}>{name}</text>
    <circle cx={x + 78} cy={y + 22} r='3.5' fill={hi ? accent : edge}/>
  </g>;
  return <svg viewBox='0 0 760 408' role='img' aria-label='連結リストへの挿入は、挿入する位置が分かっていれば、ポインターを2か所書き換えるだけで済む' fontSize='13'>
    <defs>
      <marker id='f43-arrow' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='6' markerHeight='6' orient='auto-start-reverse'><path d='M0 0L10 5L0 10z' fill={edge}/></marker>
      <marker id='f43-arrow-a' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='6' markerHeight='6' orient='auto-start-reverse'><path d='M0 0L10 5L0 10z' fill={accent}/></marker>
    </defs>
    <text data-claude-text-id='title' x='24' y='34' fontSize='15' fontWeight='600' fill={ink}>連結リストへの挿入は、ポインターを2か所書き換えるだけで済む</text>
    <text data-claude-text-id='key' x='24' y='56' fontSize='11.5' fill={quiet}>箱の右の区画が、次のデータの場所を指すポインター。AとBの間にXを挿入する</text>
    <g data-claude-anchor='before'>
      <text data-claude-text-id='before-label' x='24' y='112' fontWeight='600' fill={ink}>挿入前</text>
      <text data-claude-text-id='head-label' x='180' y='78' textAnchor='middle' fontSize='11.5' fill={quiet}>先頭</text>
      {cell(150, 86, 'A')}{cell(370, 86, 'B')}{cell(590, 86, 'C')}
      <g fill='none' stroke={edge} strokeWidth='1.25'><path d='M228 108H366' markerEnd='url(#f43-arrow)'/><path d='M448 108H586' markerEnd='url(#f43-arrow)'/></g>
      <text data-claude-text-id='end-label-1' x='668' y='148' textAnchor='middle' fontSize='11.5' fill={quiet}>次はない（末尾）</text>
    </g>
    <line x1='24' x2='736' y1='176' y2='176' stroke='var(--cds-chart-grid)'/>
    <g data-claude-anchor='after'>
      <text data-claude-text-id='after-label' x='24' y='238' fontWeight='600' fill={ink}>挿入後</text>
      {cell(150, 212, 'A')}{cell(370, 212, 'B')}{cell(590, 212, 'C')}{cell(260, 304, 'X', true)}
      <path d='M448 234H586' fill='none' stroke={edge} strokeWidth='1.25' markerEnd='url(#f43-arrow)'/>
      <path d='M232 234H366' fill='none' stroke={quiet} strokeWidth='1.25' strokeDasharray='4 4'/>
      <text data-claude-text-id='old-link' x='299' y='226' textAnchor='middle' fontSize='11.5' fill={quiet}>元の矢印は消える</text>
      <g fill='none' stroke={accent} strokeWidth='2'><path d='M338 326H418V260' markerEnd='url(#f43-arrow-a)'/><path d='M228 238V326H256' markerEnd='url(#f43-arrow-a)'/></g>
      <text data-claude-text-id='step-1a' x='432' y='300' fontWeight='600' fill={ink}>① Xのポインターに、Bの場所を書く</text>
      <text data-claude-text-id='step-1b' x='432' y='318' fontSize='11.5' fill={quiet}>Bの場所は、Aのポインターから写す</text>
      <text data-claude-text-id='step-2a' x='214' y='300' textAnchor='end' fontWeight='600' fill={ink}>② Aのポインターを、</text>
      <text data-claude-text-id='step-2b' x='214' y='318' textAnchor='end' fontWeight='600' fill={ink}>Xの場所に書き換える</text>
    </g>
    <text data-claude-text-id='note' x='24' y='384' fontSize='12' fill={ink}>書き換えが2か所で済むのは、挿入する位置（A）が分かっているとき。位置を探すには、先頭から順にたどる必要がある</text>
  </svg>;
};
