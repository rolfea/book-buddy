import { Camera } from '~/camera/camera';

export function Scanner() {
  return (
    <div>
      <h1>Scan a barcode using your device's camera</h1>
      <Camera />
    </div>
  );
}
