const W = 150, TOP = 92, HEAD = 30, ROW = 24, LINE_Y = 152;
const entities = [
  { id: 'member', x: 16, name: '会員', attrs: [['会員番号', 'PK'], ['氏名', ''], ['都道府県', '']] },
  { id: 'order', x: 210, name: '注文', attrs: [['注文番号', 'PK'], ['注文日', ''], ['会員番号', 'FK']] },
  { id: 'item', x: 404, name: '注文明細', attrs: [['注文番号', 'PK・FK'], ['商品番号', 'PK・FK'], ['数量', ''], ['注文時の単価', '']] },
  { id: 'product', x: 598, name: '商品', attrs: [['商品番号', 'PK'], ['商品名', ''], ['現在の価格', '']] },
];
const stroke = { stroke: 'var(--cds-chart-categorical-2)', strokeWidth: 1.5, fill: 'none' };
// 「1」の側：縦線2本。x は箱の辺、dir は線が伸びる向き（+1 は右、-1 は左）
const one = (x, y, dir, key) => <g key={key} {...stroke}><path d={`M${x + dir * 7} ${y - 7}V${y + 7}M${x + dir * 13} ${y - 7}V${y + 7}`}/></g>;
// 「多」の側：鳥の足。min が 0 なら丸、1 なら縦線を内側に添える
const many = (x, y, dir, min, key) => <g key={key} {...stroke}>
  <path d={`M${x + dir * 13} ${y}L${x} ${y - 8}M${x + dir * 13} ${y}L${x} ${y + 8}`}/>
  {min === 0
    ? <circle cx={x + dir * 18} cy={y} r='4.5'/>
    : <path d={`M${x + dir * 18} ${y - 7}V${y + 7}`}/>}
  <path d={`M${x} ${y}H${x + dir * 13.5}`}/>
</g>;
const Entity = ({ e }) => {
  const h = HEAD + ROW * e.attrs.length;
  return <g data-claude-anchor={'entity-' + e.id}>
    <rect x={e.x} y={TOP} width={W} height={h} rx='4' fill='none' stroke='var(--cds-chart-axis)' strokeWidth='1.25'/>
    <path d={`M${e.x} ${TOP + HEAD}V${TOP + 4}a4 4 0 0 1 4 -4H${e.x + W - 4}a4 4 0 0 1 4 4V${TOP + HEAD}z`} fill='var(--cds-chart-categorical-1)' fillOpacity='0.14' stroke='var(--cds-chart-axis)' strokeWidth='1.25'/>
    <text data-claude-text-id={e.id + '-name'} x={e.x + W / 2} y={TOP + 20} textAnchor='middle' fontWeight='600' fill='var(--cds-text-primary)'>{e.name}</text>
    {e.attrs.map(([a, k], i) => <g key={a}>
      <text data-claude-text-id={e.id + '-a' + i} x={e.x + 10} y={TOP + HEAD + ROW * i + 17} fontSize='12.5' fill='var(--cds-text-primary)'>{a}</text>
      {k && <text data-claude-text-id={e.id + '-k' + i} x={e.x + W - 8} y={TOP + HEAD + ROW * i + 17} textAnchor='end' fontSize='11' fill='var(--cds-text-secondary)'>{k}</text>}
    </g>)}
  </g>;
};
const gap = i => entities[i].x + W;
// 線は、丸（0以上）のある端では丸の手前で止める
const link = (x1, x2, y, zero1, zero2, key) => <path key={key} d={`M${zero1 ? x1 + 22.5 : x1} ${y}H${zero2 ? x2 - 22.5 : x2}`} {...stroke}/>;
export default () => <svg viewBox='0 0 760 320' role='img' aria-label='ネットショップのER図。会員と注文、注文と注文明細、商品と注文明細が、それぞれ1対多で結ばれている' fontSize='13'>
  <text data-claude-text-id='title' x='16' y='34' fontSize='15' fontWeight='600' fill='var(--cds-text-primary)'>ER図は、エンティティ（箱）と、その間の数の対応（線の端の記号）を描く</text>
  <text data-claude-text-id='keys' x='16' y='62' fontSize='11.5' fill='var(--cds-text-secondary)'>PK＝主キー、FK＝外部キー。注文明細の主キーは、注文番号と商品番号の組（複合キー）。</text>
  {entities.map(e => <Entity key={e.id} e={e}/>)}
  <g data-claude-anchor='relations'>
    {link(gap(0), entities[1].x, LINE_Y, false, true, 'k1')}
    {link(gap(1), entities[2].x, LINE_Y, false, false, 'k2')}
    {link(gap(2), entities[3].x, LINE_Y, true, false, 'k3')}
    {one(gap(0), LINE_Y, 1, 'r1a')}{many(entities[1].x, LINE_Y, -1, 0, 'r1b')}
    {one(gap(1), LINE_Y, 1, 'r2a')}{many(entities[2].x, LINE_Y, -1, 1, 'r2b')}
    {many(gap(2), LINE_Y, 1, 0, 'r3a')}{one(entities[3].x, LINE_Y, -1, 'r3b')}
  </g>
  <text data-claude-text-id='rel-1' x='188' y='134' textAnchor='middle' fontSize='11.5' fill='var(--cds-text-secondary)'>1対多</text>
  <text data-claude-text-id='rel-2' x='382' y='134' textAnchor='middle' fontSize='11.5' fill='var(--cds-text-secondary)'>1対多</text>
  <text data-claude-text-id='rel-3' x='576' y='134' textAnchor='middle' fontSize='11.5' fill='var(--cds-text-secondary)'>多対1</text>
  <g data-claude-anchor='legend'>
    <text data-claude-text-id='legend-title' x='16' y='262' fontSize='12' fontWeight='600' fill='var(--cds-text-primary)'>線の端の記号</text>
    {link(16, 60, 290, false, false, 'lk1')}{one(60, 290, -1, 'l1')}
    <text data-claude-text-id='legend-one' x='70' y='294' fontSize='11.5' fill='var(--cds-text-primary)'>ちょうど1つ</text>
    {link(190, 234, 290, false, true, 'lk2')}{many(234, 290, -1, 0, 'l2')}
    <text data-claude-text-id='legend-zero-many' x='244' y='294' fontSize='11.5' fill='var(--cds-text-primary)'>0以上（なくてもよい、複数でもよい）</text>
    {link(500, 544, 290, false, false, 'lk3')}{many(544, 290, -1, 1, 'l3')}
    <text data-claude-text-id='legend-one-many' x='554' y='294' fontSize='11.5' fill='var(--cds-text-primary)'>1以上（少なくとも1つ）</text>
  </g>
</svg>;
