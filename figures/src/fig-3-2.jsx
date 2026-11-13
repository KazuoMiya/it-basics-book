export default () => {
  const ink = 'var(--cds-text-primary)', quiet = 'var(--cds-text-secondary)', edge = 'var(--cds-chart-axis)', accent = 'var(--cds-chart-categorical-1)';
  const node = (x, y, main) => <rect x={x} y={y} width='200' height='60' rx='8' fill={main ? accent : 'none'} fillOpacity={main ? 0.12 : 1} stroke={main ? accent : edge} strokeWidth={main ? 2 : 1.25}/>;
  return <svg viewBox='0 0 760 364' role='img' aria-label='プロセスは実行可能・実行・待ちの3つの状態を移り変わる' fontSize='13'>
    <defs><marker id='f32-arrow' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='6' markerHeight='6' orient='auto-start-reverse'><path d='M0 0L10 5L0 10z' fill={edge}/></marker></defs>
    <text data-claude-text-id='title' x='24' y='34' fontSize='15' fontWeight='600' fill={ink}>プロセスは3つの状態を移り変わり、CPUを使えるのは実行状態のときだけ</text>
    <g data-claude-anchor='connectors' fill='none' stroke={edge} strokeWidth='1.25'>
      <path d='M34 120H96' markerEnd='url(#f32-arrow)'/>
      <path d='M300 108H466' markerEnd='url(#f32-arrow)'/>
      <path d='M470 134H304' markerEnd='url(#f32-arrow)'/>
      <path d='M670 120H732' markerEnd='url(#f32-arrow)'/>
      <path d='M570 150V300H484' markerEnd='url(#f32-arrow)'/>
      <path d='M280 300H200V154' markerEnd='url(#f32-arrow)'/>
    </g>
    <g data-claude-anchor='ready'>{node(100, 90, false)}
      <text data-claude-text-id='ready-name' x='200' y='116' textAnchor='middle' fontWeight='600' fill={ink}>実行可能状態</text>
      <text data-claude-text-id='ready-sub' x='200' y='134' textAnchor='middle' fontSize='11.5' fill={quiet}>CPUが空くのを、列に並んで待つ</text></g>
    <g data-claude-anchor='running'>{node(470, 90, true)}
      <text data-claude-text-id='run-name' x='570' y='116' textAnchor='middle' fontWeight='600' fill={ink}>実行状態</text>
      <text data-claude-text-id='run-sub' x='570' y='134' textAnchor='middle' fontSize='11.5' fill={ink}>CPUで命令を実行している</text></g>
    <g data-claude-anchor='waiting'>{node(280, 270, false)}
      <text data-claude-text-id='wait-name' x='380' y='296' textAnchor='middle' fontWeight='600' fill={ink}>待ち状態</text>
      <text data-claude-text-id='wait-sub' x='380' y='314' textAnchor='middle' fontSize='11.5' fill={quiet}>入出力の完了などを待つ</text></g>
    <g data-claude-anchor='labels' fontSize='12'>
      <text data-claude-text-id='l-start' x='64' y='110' textAnchor='middle' fill={quiet}>起動</text>
      <text data-claude-text-id='l-end' x='702' y='110' textAnchor='middle' fill={quiet}>終了</text>
      <text data-claude-text-id='l-dispatch' x='385' y='98' textAnchor='middle' fill={ink}>CPUを割り当てられる</text>
      <text data-claude-text-id='l-preempt-1' x='385' y='154' textAnchor='middle' fill={ink}>持ち時間を使い切る</text>
      <text data-claude-text-id='l-preempt-2' x='385' y='172' textAnchor='middle' fill={quiet}>（タイマーの割込み）</text>
      <text data-claude-text-id='l-block-1' x='584' y='218' fill={ink}>入出力を頼み、</text>
      <text data-claude-text-id='l-block-2' x='584' y='236' fill={ink}>完了を待つ</text>
      <text data-claude-text-id='l-wake-1' x='186' y='218' textAnchor='end' fill={ink}>入出力が完了する</text>
      <text data-claude-text-id='l-wake-2' x='186' y='236' textAnchor='end' fill={quiet}>（割込みで知らされる）</text>
    </g>
  </svg>;
};
