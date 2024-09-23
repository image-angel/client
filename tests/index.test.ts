import { Client, DetectionResults } from "../src/index";

describe("Testing ImageAngel Client", () => {
  // Create an ImageAngel client using a test key.
  // Requests made using this key will be rejected by the ImageAngel API.
  // Please visit https://imageangel.co.uk to obtain a production API key.
  const client = new Client(
    "test-key",
    "6680e5f1ec113adfa927c41acb8079fad1e05b6b3ce4d9c3ce0ed0560edc9b1d",
  );

  test("URL Roundtrip", async () => {
    // Create a watermarking URL, and check it has the right shape.
    // When accessed, this URL would return a watermarked version of the source image (if the key were registered).
    // It is safe to share with users, because the underlying source URL is encrypted.
    const urlString = await client.makeUrl(
      "http://my.files/secret𓆩♡𓆪.jpeg",
      "name.jpeg",
      1234,
      "auxinfo",
    );
    expect(urlString).toMatch(
      /^https:\/\/api\.imageangel\.co\.uk\/wm\/name\.jpeg\?u=auxinfo&s=([a-zA-Z0-9]|(%3D)|(%2F)|(%2B))*$/,
    );

    // The same assertion on the Image Angel URL, done piece-by-piece.
    const urlParts = new URL(urlString);
    expect(urlParts).toMatchObject({
      origin: "https://api.imageangel.co.uk",
      pathname: "/wm/name.jpeg",
    });
    expect(urlParts.searchParams.get("u")).toBe("auxinfo");
    expect(urlParts.searchParams.get("s")).toMatch(/^[a-zA-Z0-9+=/]*$/);

    // Parse and decrypt the watermarking URL and verify the contents.
    // This can only be done by someone who knows the encryption key.
    const decrypted = await client.decryptUrl(urlString);
    expect(decrypted).toStrictEqual({
      src: "http://my.files/secret𓆩♡𓆪.jpeg",
      key: "test-key",
      host: "https://api.imageangel.co.uk",
      path: "/wm/name.jpeg",
      watermark: 1234,
      auxinfo: "auxinfo",
      auxinfoMatches: true,
      watermarkMethod: "v0",
    });

    // Change the auxinfo in the URL and try again. The information is still recoverable,
    // because we have the encryption key, but we can tell that the auxinfo has been modified.
    // ImageAngel will refuse to serve images from URLs tampered with like this.
    const tamperedUrl = urlString.replace("auxinfo", "auxinf0");
    const tamperedPieces = await client.decryptUrl(tamperedUrl);
    expect(tamperedPieces).toStrictEqual({
      src: "http://my.files/secret𓆩♡𓆪.jpeg",
      key: "test-key",
      host: "https://api.imageangel.co.uk",
      path: "/wm/name.jpeg",
      watermark: 1234,
      auxinfo: "auxinf0", // The auxinfo now present in the URL...
      auxinfoMatches: false, // ...does not match the auxinfo originally supplied.
      watermarkMethod: "v0",
    });
  });

  test("Detect Finds Watermark", async () => {
    // Mock the fetch function used to access the Image Angel API.
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(
      jest.fn(
        () =>
          Promise.resolve({
            status: 200,
            ok: true,
            json: () => Promise.resolve({ watermark: 8888 }),
          }) as unknown as Response,
      ) as jest.Mock,
    );

    // Run detect on a fake image blob.
    const blob = new Blob(["fake data"], { type: "image/jpeg" });
    const results = await client.detect(blob);

    // Verify we get the expected result.
    expect(results).toStrictEqual(<DetectionResults>{ watermark: 8888 });

    // Undo the mock.
    fetchMock.mockRestore();
  });

  test("Detect Fails to Find Watermark", async () => {
    // Mock the fetch function used to access the Image Angel API.
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(
      jest.fn(
        () =>
          Promise.resolve({
            status: 200,
            ok: true,
            json: () => Promise.resolve({ message: "No Watermark Found" }),
          }) as unknown as Response,
      ) as jest.Mock,
    );

    // Run detect on a fake image blob.
    const blob = new Blob(["fake data"], { type: "image/jpeg" });
    const results = await client.detect(blob);

    // Verify we get the expected result.
    expect(results).toStrictEqual(<DetectionResults>{
      message: "No Watermark Found",
    });

    // Undo the mock.
    fetchMock.mockRestore();
  });
});
