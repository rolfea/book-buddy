import type { DetectedBarcode } from 'barcode-detector';
import { useEffect, useState } from 'react';

export interface BookListProps {
  scannedIsbns: DetectedBarcode['rawValue'][];
}

interface Book {
  isbn: string;
  title: string;
}

export function Booklist({ scannedIsbns }: BookListProps) {
  const [foundBooks, setFoundBooks] = useState<Book[]>([]);

  useEffect(() => {
    const latest = scannedIsbns.at(-1);
    if (!!latest) {
      const latestBook = { title: `random book ${latest}`, isbn: latest };
      setFoundBooks([...foundBooks, latestBook]);
    }
  }, [scannedIsbns]);

  const bookList = foundBooks.map((book) => (
    <li key={crypto.randomUUID()}>{book.title}</li>
  ));

  return (
    <div>
      <h1>I'm a book list, yo!</h1>
      <ul>{bookList}</ul>
    </div>
  );
}
