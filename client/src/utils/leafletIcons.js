import L from 'leaflet';

export const createPlaceIcon = (kind, status) => {
  let bgColor = '#2563eb';
  let symbol = '🏠';
  let border = '#ffffff';

  if (kind === 'SHELTER') {
    bgColor = '#2563eb';
    symbol = '🏠';
  } else if (kind === 'FOOD') {
    bgColor = '#16a34a';
    symbol = '🍲';
  } else if (kind === 'MEDICAL') {
    bgColor = '#dc2626';
    symbol = '🏥';
  }

  if (status === 'FULL') border = '#f59e0b';
  if (status === 'CLOSED') border = '#6b7280';

  return L.divIcon({
    className: 'custom-place-marker',
    html: `
      <div style="
        background: ${bgColor};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        border: 2px solid ${border};
        font-size: 18px;
        cursor: pointer;
        transition: transform 0.2s;
      ">
        ${symbol}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

export const createReportIcon = (type, status) => {
  let bgColor = '#6b7280';
  let symbol = '⚠️';
  let pulse = '';

  if (type === 'RESCUE') {
    bgColor = '#9333ea';
    symbol = '🚨';
    pulse = 'animation: pulse 1.5s infinite;';
  } else {
    if (status === 'UNVERIFIED') bgColor = '#6b7280';
    else if (status === 'LIKELY') bgColor = '#ea580c';
    else if (status === 'VERIFIED') bgColor = '#dc2626';

    if (type === 'FLOODED_ROAD') symbol = '🌊';
    else if (type === 'BLOCKED_ROUTE') symbol = '🚧';
    else if (type === 'SHELTER_FULL') symbol = '🚫';
  }

  return L.divIcon({
    className: 'custom-report-marker',
    html: `
      <div style="
        background: ${bgColor};
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        border: 2px solid #ffffff;
        font-size: 16px;
        cursor: pointer;
        ${pulse}
      ">
        ${symbol}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
  });
};
