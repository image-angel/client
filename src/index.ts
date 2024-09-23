import {
  RawAesKeyringNode,
  buildClient,
  CommitmentPolicy,
  RawAesWrappingSuiteIdentifier,
} from "@aws-crypto/client-node";
import { createHash } from "crypto";
import { URL } from "url";

const { encrypt, decrypt } = buildClient(
  CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT,
);

export enum WatermarkMethod {
  v0 = "v0",
}

export interface DetectionResults {
  message?: string;
  watermark?: number;
}

export interface UrlPieces {
  host: string;
  path: string;
  watermark: number;
  auxInfo: string;
  watermarkMethod: WatermarkMethod;
}

export class Client {
  apiRoot: string;
  watermarkMethod: WatermarkMethod;
  readonly apiKey: string;
  readonly keyring: RawAesKeyringNode;

  constructor(keyName: string, keyValue: string) {
    this.apiKey = keyValue;
    this.apiRoot = "https://api.imageangel.co.uk/";
    this.watermarkMethod = WatermarkMethod.v0;

    const wrappingSuite =
      RawAesWrappingSuiteIdentifier.AES256_GCM_IV12_TAG16_NO_PADDING;

    const keyNamespace = "image-angel";
    const unencryptedMasterKey = Uint8Array.from(Buffer.from(keyValue, "hex"));
    this.keyring = new RawAesKeyringNode({
      keyName,
      keyNamespace,
      unencryptedMasterKey,
      wrappingSuite,
    });
  }

  async makeUrl(
    sourceUrl: string,
    filename: string,
    watermark: number,
    auxinfo: string,
  ): Promise<string> {
    const context = {
      u: createHash("md5").update(auxinfo).digest("hex"),
      w: watermark.toString(16),
      a: this.watermarkMethod,
    };
    const { result } = await encrypt(this.keyring, sourceUrl, {
      encryptionContext: context,
    });
    return (
      this.apiRoot +
      "wm/" +
      filename +
      "?" +
      new URLSearchParams({
        u: auxinfo,
        s: result.toString("base64"),
      }).toString()
    );
  }

  async decryptUrl(urlString: string): Promise<Object> {
    const url = new URL(urlString);
    const encryptedSourceUrl = Buffer.from(
      <string>url.searchParams.get("s"),
      "base64",
    );
    const { plaintext, messageHeader } = await decrypt(
      this.keyring,
      encryptedSourceUrl,
    );
    const auxinfo = <string>url.searchParams.get("u");
    const auxinfoHash = createHash("md5").update(auxinfo).digest("hex");
    const keyId: Uint8Array = <Uint8Array>(
      messageHeader.encryptedDataKeys[0].rawInfo
    );
    const keyIdStr = Buffer.from(keyId.slice(0, -20)).toString("ascii");
    return {
      src: plaintext.toString("utf-8"),
      key: keyIdStr,
      host: url.origin,
      path: url.pathname,
      watermark: parseInt(messageHeader.encryptionContext.w, 16),
      auxinfo: url.searchParams.get("u"),
      auxinfoMatches: auxinfoHash == messageHeader.encryptionContext.u,
      watermarkMethod: messageHeader.encryptionContext.a,
    };
  }

  async detect(imageData: Blob): Promise<DetectionResults> {
    try {
      const response = await fetch(
        this.apiRoot + "detect?a=" + this.watermarkMethod + "&k=" + this.apiKey,
        {
          method: "POST",
          body: imageData,
          credentials: "omit",
          headers: {
            Accept: "application/json",
            "Content-Type": "image/jpeg",
          },
        },
      );
      if (!response.ok) {
        console.error("Error detecting watermark:", response);
      }
      return response.json();
    } catch (error) {
      console.error("Error detecting watermark:", error);
      throw error;
    }
  }
}
