const ALPHABET = {
    52: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP",
    54: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR",
    62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    95: " !\"#$%&\\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~"
};

function unbase(value, base) {
    if (base >= 2 && base <= 36) {
        return parseInt(value, base) || 0;
    }
    let selector = 52;
    if (base > 62) selector = 95;
    else if (base > 54) selector = 62;
    else if (base > 52) selector = 54;

    const dict = ALPHABET[selector];
    let returnVal = 0;
    const valArray = value.split('').reverse();
    for (let i = 0; i < valArray.length; i++) {
        const cipher = valArray[i];
        const index = dict.indexOf(cipher);
        returnVal += Math.pow(base, i) * (index !== -1 ? index : 0);
    }
    return returnVal;
}

function detect(scriptBlock) {
    const packedRegex = /eval\(\s*function\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[r|d]?/im;
    return packedRegex.test(scriptBlock);
}

function unpack(scriptBlock) {
    if (!detect(scriptBlock)) return scriptBlock;

    // Based on MoonGetter Regex
    const extractRegex = /\}\s*\(\s*'(.*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'(.*?)'\.split\('\|'\)/s;
    let match = scriptBlock.match(extractRegex);

    // Sometimes the packer escapes single quotes as \' instead of raw quotes, so regex might need tweaks
    // If simple regex fails, we can fall back to a more robust regex parsing if needed.
    if (!match) {
        // Variant: double quotes for payload or split
        const extractRegex2 = /\}\s*\(\s*"(.*?)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*"(.*?)"\.split\('\|'\)/s;
        match = scriptBlock.match(extractRegex2);
    }

    if (!match) return scriptBlock;

    const payload = match[1];
    const radix = parseInt(match[2], 10) || 10;
    const count = parseInt(match[3], 10);
    const symtab = match[4].split('|');

    if (symtab.length !== count) return scriptBlock;

    const unpacked = payload.replace(/\b\w+\b/g, (word) => {
        const unbased = unbase(word, radix);
        const replacement = symtab[unbased];
        return replacement && replacement.length > 0 ? replacement : word;
    });

    return unpacked;
}

module.exports = {
    detect,
    unpack
};
