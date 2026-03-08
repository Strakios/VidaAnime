// Servicio simplificado de Firebase que utiliza la API REST nativa
// Sin dependencias de NPM (Node-fetch nativo en Node 22)

const PROJECT_ID = 'anim-ukiku-server';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/**
 * Obtiene un documento de Firestore vía REST API.
 */
async function getFirestoreDoc(uid, collectionId, docId) {
    try {
        const res = await fetch(`${BASE_URL}/users/${uid}/${collectionId}/${docId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return parseFirestoreDoc(data);
    } catch (e) {
        console.error('[Firebase REST] Error GET:', e.message);
        return null; // El documento no existe o hay error de red
    }
}

/**
 * Escribe un documento en Firestore vía REST API mediante PATCH.
 */
async function setFirestoreDoc(uid, collectionId, docId, listData) {
    try {
        const firestoreFormattedData = buildFirestoreDoc(listData);
        const url = `${BASE_URL}/users/${uid}/${collectionId}/${docId}?updateMask.fieldPaths=list`;

        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(firestoreFormattedData)
        });

        if (!res.ok) {
            console.error('[Firebase REST] Error SET Status:', res.status, await res.text());
        }
        return res.ok;
    } catch (e) {
        console.error('[Firebase REST] Error SET:', e.message);
        return false;
    }
}

// ─── Utilidades de Mapeo Firestore-REST a JSON ───

function parseFirestoreDoc(doc) {
    if (!doc || !doc.fields || !doc.fields.list || !doc.fields.list.arrayValue || !doc.fields.list.arrayValue.values) {
        return { list: [] };
    }

    // Convertir el infierno de arrays anidados de Firestore REST a JS Object puro
    const list = doc.fields.list.arrayValue.values.map(val => {
        const fields = val.mapValue.fields;
        const obj = {};
        for (const key in fields) {
            obj[key] = fields[key].stringValue !== undefined ? fields[key].stringValue :
                fields[key].integerValue !== undefined ? parseInt(fields[key].integerValue) :
                    fields[key].doubleValue !== undefined ? parseFloat(fields[key].doubleValue) :
                        fields[key].booleanValue !== undefined ? fields[key].booleanValue : null;
        }
        return obj;
    });

    return { list };
}

function buildFirestoreDoc(listArray) {
    const values = listArray.map(obj => {
        const fields = {};
        for (const key in obj) {
            const val = obj[key];
            if (typeof val === 'string') fields[key] = { stringValue: val };
            else if (typeof val === 'number') {
                if (Number.isInteger(val)) fields[key] = { integerValue: val.toString() };
                else fields[key] = { doubleValue: val };
            }
            else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
            else if (val === null) fields[key] = { nullValue: null };
            else fields[key] = { stringValue: String(val) };
        }
        return { mapValue: { fields } };
    });

    return {
        name: `projects/${PROJECT_ID}/databases/(default)/documents/users/000/backups/000`,
        fields: {
            list: {
                arrayValue: { values }
            }
        }
    };
}

module.exports = {
    getFirestoreDoc,
    setFirestoreDoc
};
