import { generateKeys } from "paseto-ts/v4";

(async () => {
    const localKey = generateKeys("local");
    console.log(localKey);
})();
