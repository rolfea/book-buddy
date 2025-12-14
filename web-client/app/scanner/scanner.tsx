import { useEffect, useState } from 'react';
import type { Route } from '../+types/root';
import { Camera } from '~/camera/camera';
import { Booklist } from '~/book-list/bookList';

export function Scanner() {
  return (
    <div>
      <h1>Scan a barcode using your device's camera</h1>
      <Camera />
      <Booklist />
    </div>
  );
}
