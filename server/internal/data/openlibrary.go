package data

type BookMetadata struct {
	ISBN     string
	Title    string
	Author   string
	CoverURL string
}

type BookMetadataClient interface {
	FetchByISBN(isbn string) (*BookMetadata, error)
}

type NoOpLibraryClient struct{}

func (n *NoOpLibraryClient) FetchByISBN(isbn string) (*BookMetadata, error) {
	return nil, nil
}
