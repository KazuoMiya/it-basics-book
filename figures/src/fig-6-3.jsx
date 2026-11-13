export default () => {
  const ink = 'var(--cds-text-primary)', quiet = 'var(--cds-text-secondary)', edge = 'var(--cds-chart-axis)', accent = 'var(--cds-chart-categorical-1)', c2 = 'var(--cds-chart-categorical-2)';
  const ry = i => 84 + i * 124;
  const cond = i => <rect x='216' y={ry(i)} width='220' height='76' rx='8' fill='var(--cds-chart-reference-tint)' stroke='var(--cds-chart-grid)' strokeWidth='1'/>;
  const dest = (i, tok) => <rect x='476' y={ry(i)} width='260' height='76' rx='8' fill={tok} fillOpacity='0.12' stroke={tok} strokeWidth='1.5'/>;
  return <svg viewBox='0 0 760 372' role='img' aria-label='宛先が同じネットワークなら直接届け、別のネットワークならデフォルトゲートウェイへ渡す' fontSize='13'>
    <defs><marker id='gw-arrow' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='6' markerHeight='6' orient='auto-start-reverse'><path d='M0 0L10 5L0 10z' fill={edge}/></marker></defs>
    <text data-claude-text-id='title' x='24' y='32' fontSize='15' fontWeight='600' fill={ink}>同じネットワークなら直接届け、別ならデフォルトゲートウェイへ渡す</text>
    <text data-claude-text-id='subtitle' x='24' y='56' fontSize='11.5' fill={quiet}>スマホは、宛先のネットワーク部を自分のネットワーク部と比べて、最初の渡し先を決める</text>
    <g data-claude-anchor='connectors' fill='none' stroke={edge} strokeWidth='1.25'>
      <path d={`M184 174H200V${ry(0) + 38}H216`} markerEnd='url(#gw-arrow)'/>
      <path d={`M184 194H200V${ry(1) + 38}H216`} markerEnd='url(#gw-arrow)'/>
      <path d={`M436 ${ry(0) + 38}H476`} markerEnd='url(#gw-arrow)'/>
      <path d={`M436 ${ry(1) + 38}H476`} markerEnd='url(#gw-arrow)'/>
    </g>
    <g data-claude-anchor='node-phone'>
      <rect x='24' y='144' width='160' height='80' rx='8' fill='none' stroke={edge} strokeWidth='1.25'/>
      <text data-claude-text-id='phone' x='40' y='168' fontWeight='600' fill={ink}>スマホ</text>
      <text data-claude-text-id='phone-ip' x='40' y='188' fontSize='11.5' fill={quiet}>192.168.1.10</text>
      <text data-claude-text-id='phone-mask' x='40' y='207' fontSize='11.5' fill={quiet}>マスク 255.255.255.0</text>
    </g>
    <g data-claude-anchor='row-same'>
      {cond(0)}
      <text data-claude-text-id='same-dst' x='232' y={ry(0) + 23} fontSize='12.5' fontWeight='600' fill={ink}>宛先 192.168.1.20</text>
      <text data-claude-text-id='same-judge' x='232' y={ry(0) + 43} fontSize='11.5' fill={ink}>ネットワーク部が自分と同じ</text>
      <text data-claude-text-id='same-arp' x='232' y={ry(0) + 62} fontSize='11.5' fill={quiet}>ARPでプリンターのMACを調べる</text>
      {dest(0, accent)}
      <text data-claude-text-id='printer' x='492' y={ry(0) + 23} fontWeight='600' fill={ink}>プリンター</text>
      <text data-claude-text-id='printer-ip' x='492' y={ry(0) + 43} fontSize='11.5' fill={ink}>192.168.1.20（同じLANの中）</text>
      <text data-claude-text-id='printer-note' x='492' y={ry(0) + 62} fontSize='11.5' fill={ink}>宛先MACも宛先IPもプリンター</text>
    </g>
    <g data-claude-anchor='row-other'>
      {cond(1)}
      <text data-claude-text-id='other-dst' x='232' y={ry(1) + 23} fontSize='12.5' fontWeight='600' fill={ink}>宛先 203.0.113.25</text>
      <text data-claude-text-id='other-judge' x='232' y={ry(1) + 43} fontSize='11.5' fill={ink}>ネットワーク部が自分と違う</text>
      <text data-claude-text-id='other-arp' x='232' y={ry(1) + 62} fontSize='11.5' fill={quiet}>ARPでルーターのMACを調べる</text>
      {dest(1, c2)}
      <text data-claude-text-id='router' x='492' y={ry(1) + 23} fontWeight='600' fill={ink}>家のルーター</text>
      <text data-claude-text-id='router-ip' x='492' y={ry(1) + 43} fontSize='11.5' fill={ink}>192.168.1.1（デフォルトゲートウェイ）</text>
      <text data-claude-text-id='router-note' x='492' y={ry(1) + 62} fontSize='11.5' fill={ink}>宛先MACはルーター、宛先IPはそのまま</text>
    </g>
    <text data-claude-text-id='onward' x='476' y={ry(1) + 98} fontSize='11.5' fill={quiet}>ここから先は、ルーターのバケツリレー（図6-2）</text>
    <text data-claude-text-id='foot' x='24' y='352' fontSize='11.5' fill={quiet}>ネットワーク部は、IPアドレスにサブネットマスクを当てて取り出す（この例では先頭の24ビット）</text>
  </svg>;
};
