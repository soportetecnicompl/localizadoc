export const COUNTRIES = {
    'HN': { name: 'Honduras', prefix: '504', flag: '🇭🇳', docTypes: ['Tarjeta de Identidad', 'Licencia de Conducir', 'Pasaporte', 'Carnet Residencia', 'Otro'] },
    'SV': { name: 'El Salvador', prefix: '503', flag: '🇸🇻', docTypes: ['DUI', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'GT': { name: 'Guatemala', prefix: '502', flag: '🇬🇹', docTypes: ['DPI', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'NI': { name: 'Nicaragua', prefix: '505', flag: '🇳🇮', docTypes: ['Cédula de Identidad', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'CR': { name: 'Costa Rica', prefix: '506', flag: '🇨🇷', docTypes: ['Cédula de Identidad', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'Otro': { name: 'Otro', prefix: '', flag: '🌎', docTypes: ['ID Nacional', 'Cédula de Ciudadanía', 'Licencia de Conducir', 'Pasaporte', 'Visa', 'Otro'] }
};

const DOC_ICONS = {
    'Tarjeta de Identidad': '🪪', 'DUI': '🪪', 'DPI': '🪪',
    'Cédula de Identidad': '🪪', 'Cédula de Ciudadanía': '🪪',
    'ID Nacional': '🪪', 'Carnet Residencia': '🪪',
    'Pasaporte': '📘', 'Visa': '📘',
    'Licencia de Conducir': '🚗',
};

export const getDocIcon = (docType) => DOC_ICONS[docType] ?? '📄';
export const DAYS_UNTIL_STALE = 180;
