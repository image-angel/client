## Image Angel Client SDK

This package is a server-side SDK for interacting with the Image Angel watermarking service.
For more information on Image Angel and to obtain an API key, see http://imageangel.co.uk

## Installation

```sh
npm install image-angel
```

## Usage

Setup:
```javascript
import { Client } from 'image-angel';
const client = new Client('my-key-name', API_KEY);
```

To create an ImageAngel URL which can be given to users:
```javascript
const urlString = await client.makeUrl(
    'https://my.files/secret.jpeg', // URL for source image
    'filename.jpeg',                // Filename to show the user
    5678,                           // Watermark to embed
    'OtherInfo'                     // Auxiliary information to include in URL
);
```
When accessed, this URL will serve a version of the image with the watermark.
The link to the non-watermarked image is encrypted in the URL, meaning there is no need to 'pre-register' the image with Image Angel, and keeping this method purely local, while ensuring the user cannot bypass the watermarking process.

To read a watermark from an image:
```javascript
const results = await client.detect(imageBlob);
if (results.watermark) {
    console.log('Watermark id ', results.watermark)
}
```
If a leaked or inappropriately shared image is found by its owner,
the watermark can be reas using this API. The image sharing platform can then determine details of the original downloader given the embedded watermark and take appropriate next steps.

## Documentation

## License

This package is distributed under the
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0),
see LICENSE for more information.
