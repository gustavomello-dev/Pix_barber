import QRCode from "qrcode";

/**
 * Formata um campo no padrão EMVCo: ID (2 dígitos) + Tamanho (2 dígitos) + Valor
 */
function formatField(id, value) {
    const strValue = String(value);
    const length = strValue.length.toString().padStart(2, "0");
    return `${id}${length}${strValue}`;
}

/**
 * Remove acentos e caracteres especiais, mantendo apenas ASCII padrão
 */
function sanitizeText(text, maxLength) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-zA-Z0-9 ]/g, "") // Mantém apenas letras, números e espaço
        .toUpperCase()
        .substring(0, maxLength)
        .trim();
}

/**
 * Calcula o checksum CRC16 (CCITT-FALSE: Polinômio 0x1021, Inicial 0xFFFF)
 * Exigido pelo Banco Central no final de todo BR Code (ID 63)
 */
function calculateCRC16(payload) {
    let crc = 0xffff;
    const polynomial = 0x1021;

    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ polynomial) & 0xffff;
            } else {
                crc = (crc << 1) & 0xffff;
            }
        }
    }

    return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Gera o Payload Pix (Copia e Cola) e a imagem QR Code em Base64
 */
export async function generatePix({
    pixKey,
    merchantName,
    merchantCity,
    amount,
    txid = "***",
}) {
    const cleanName = sanitizeText(merchantName, 25);
    const cleanCity = sanitizeText(merchantCity, 15);
    const formattedAmount = Number(amount).toFixed(2);

    // ID 26: Merchant Account Information (GUI do BACEN + Chave Pix)
    const gui = formatField("00", "br.gov.bcb.pix");
    const key = formatField("01", pixKey.trim());
    const merchantAccountInfo = formatField("26", `${gui}${key}`);

    // ID 62: Additional Data Field Template (TXID - Identificador da Transação)
    // No Pix Estático, '***' é o padrão oficial quando não há código único específico
    const cleanTxid =
        txid === "***" ? "***" : sanitizeText(txid, 25).replace(/\s+/g, "");
    const additionalData = formatField("62", formatField("05", cleanTxid));

    // Montagem sequencial dos campos obrigatórios do BR Code
    const payloadSemCRC = [
        formatField("00", "01"), // Payload Format Indicator (Versão 01)
        merchantAccountInfo, // Dados da conta (ID 26)
        formatField("52", "0000"), // Merchant Category Code (0000 = Geral)
        formatField("53", "986"), // Transaction Currency (986 = Real Brasileiro BRL)
        formatField("54", formattedAmount), // Valor da transação (ex: "35.00")
        formatField("58", "BR"), // Country Code
        formatField("59", cleanName), // Nome do Recebedor (máx 25 chars)
        formatField("60", cleanCity), // Cidade do Recebedor (máx 15 chars)
        additionalData, // TXID (ID 62)
        "6304", // ID 63 (CRC16) + Tamanho '04'
    ].join("");

    // Calcula o CRC16 e concatena ao final
    const crc16 = calculateCRC16(payloadSemCRC);
    const copiaECola = `${payloadSemCRC}${crc16}`;

    // Converte a string Copia e Cola em uma imagem Data URL (Base64)
    const qrCodeImage = await QRCode.toDataURL(copiaECola, {
        width: 300,
        margin: 2,
        color: {
            dark: "#000000",
            light: "#FFFFFF",
        },
    });

    return {
        copiaECola,
        qrCodeImage,
    };
}
