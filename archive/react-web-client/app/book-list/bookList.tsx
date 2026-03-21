import type { DetectedBarcode } from 'barcode-detector';
import { useEffect, useState } from 'react';

export interface BookListProps {
  scannedIsbns: DetectedBarcode['rawValue'][];
}

interface Book {
  isbn: string;
  title: string;
  author: string;
  publishedYear: string;
}

export function Booklist({ scannedIsbns }: BookListProps) {
  const [foundBooks, setFoundBooks] = useState<Book[]>([]);

  useEffect(() => {
    const fetchBook = async (isbn: DetectedBarcode['rawValue']) => {
      const found = await fetch(
        `https://openlibrary.org/search.json?q=${latest}`,
      );

      if (found.ok) {
        // just assume we get 1 back for now
        const data = (await found.json()).docs.at(0);
        console.info(`Debug Log - found the book:  ${JSON.stringify(data)}`);

        const latestBook = {
          title: data.title,
          isbn,
          author: data.author_name,
          publishedYear: data.first_publish_year,
        };
        setFoundBooks([...foundBooks, latestBook]);
      }
    };

    const latest = scannedIsbns.at(-1);
    if (!!latest) {
      fetchBook(latest);
    }
  }, [scannedIsbns]);

  const bookList = foundBooks.map((book) => (
    <li key={crypto.randomUUID()}>
      <p>
        <b>{book.title}</b> {' | ' + book.author + ' | '} published in{' '}
        {book.publishedYear}
      </p>
    </li>
  ));

  return (
    <div>
      <h1>I'm a book list, yo!</h1>
      <ul>{bookList}</ul>
    </div>
  );
}
