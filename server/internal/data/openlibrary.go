package data

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

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

type openLibraryAuthor struct {
	Name string `json:"name"`
}

type openLibraryCover struct {
	Small  string `json:"small"`
	Medium string `json:"medium"`
	Large  string `json:"large"`
}

type openLibraryBook struct {
	Title   string              `json:"title"`
	Authors []openLibraryAuthor `json:"authors"`
	Cover   openLibraryCover    `json:"cover"`
}

type HTTPBookMetadataClient struct {
	baseURL string
	client  *http.Client
}

func NewHTTPBookMetadataClient(baseURL string) *HTTPBookMetadataClient {
	return &HTTPBookMetadataClient{
		baseURL: baseURL,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *HTTPBookMetadataClient) FetchByISBN(isbn string) (*BookMetadata, error) {
	url := fmt.Sprintf("%s/api/books?bibkeys=ISBN:%s&format=json&jscmd=data", c.baseURL, isbn)
	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code from OpenLibrary API: %d", resp.StatusCode)
	}

	var result map[string]openLibraryBook
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode JSON: %w", err)
	}

	key := "ISBN:" + isbn
	book, ok := result[key]
	if !ok {
		return nil, nil // Not found on OpenLibrary
	}

	authorNames := make([]string, 0, len(book.Authors))
	for _, author := range book.Authors {
		if author.Name != "" {
			authorNames = append(authorNames, author.Name)
		}
	}
	author := strings.Join(authorNames, ", ")
	if author == "" {
		author = "Unknown"
	}

	coverURL := book.Cover.Large
	if coverURL == "" {
		coverURL = book.Cover.Medium
	}
	if coverURL == "" {
		coverURL = book.Cover.Small
	}

	return &BookMetadata{
		ISBN:     isbn,
		Title:    book.Title,
		Author:   author,
		CoverURL: coverURL,
	}, nil
}
