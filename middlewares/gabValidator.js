const crypto = require('crypto');

const validateHmacSignature = (req, res, next) => {
  const receivedHash = req.body.Hash;
  if (!receivedHash) {
    return res.status(400).json({ Result: "Failure" });
  }

  const secretKey = process.env.GAB_SECRET_KEY;
  if (!secretKey) {
    console.error("GAB_SECRET_KEY n'est pas définie.");
    return res.status(500).json({ Result: "Failure" });
  }

  const {
    TransactionDate,
    TransactionAmount,
    TransactionNarration,
    TransactionReference,
    TransactionDRCRIndicator,
  } = req.body;

  // Formatage du montant avec 2 décimales
  const formattedAmount = Number(TransactionAmount).toFixed(2);

  // Construction de la chaîne à hasher selon la spécification
  const dataString = 
    String(TransactionDate) +
    formattedAmount +
    String(TransactionNarration) +
    String(TransactionReference) +
    String(TransactionDRCRIndicator);

  // CORRECTION: SHA-256 simple avec clé secrète ajoutée à la fin
  const stringToHash = dataString + secretKey;
  const calculatedHash = crypto
    .createHash('sha256')
    .update(stringToHash, 'utf-8')
    .digest('base64');

  // Logs de débogage
  console.log("--- Début validation SHA-256 + Clé ---");
  console.log("Reçu de la banque :", receivedHash);
  console.log("Calculé par nous   :", calculatedHash);
  console.log("Chaîne hashée      :", stringToHash);
  console.log("---------------------------------------");

  try {
    const receivedBuffer = Buffer.from(receivedHash, 'base64');
    const calculatedBuffer = Buffer.from(calculatedHash, 'base64');

    if (receivedBuffer.length !== calculatedBuffer.length || 
        !crypto.timingSafeEqual(receivedBuffer, calculatedBuffer)) {
      throw new Error("Hashes do not match");
    }
  } catch (error) {
    console.error("Validation du hash échouée ! Message potentiellement altéré.");
    return res.status(400).json({ Result: "Failure" });
  }

  console.log("✅ Validation SHA-256 réussie !");
  next();
};

module.exports = { validateHmacSignature };