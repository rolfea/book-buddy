# Go Learning Notes

## HTTP Handler Signatures

### Question
What does the function signature `func (c *BooksController) List(w http.ResponseWriter, r *http.Request)` mean?

### Answer
- `(c *BooksController)` is the receiver — Go's way of attaching a function to a type, making it a method. `c` is the instance (like `this` in other languages).
- `w http.ResponseWriter` is the object you write your response to.
- `r *http.Request` is a pointer to the incoming request — contains headers, body, URL params, and context.
- No return value — instead of returning errors, you write to `w` and call `return` to stop execution early.

---

## Functions vs Methods

### Question
Does Go distinguish between a function and a method?

### Answer
Yes. A method has a receiver, a function does not:

```go
// Function — standalone
func Add(a int, b int) int { ... }

// Method — attached to BooksController via receiver
func (c *BooksController) List(w http.ResponseWriter, r *http.Request) { ... }
```

Go has no classes — just types with methods attached to them via the receiver declaration.

---

## Dependency Injection

### Question
Instantiating a service in `main()` and passing it to a controller constructor — what pattern is this?

### Answer
This is **dependency injection**. Instead of the controller reaching out and grabbing its own dependency, the dependency is injected from the outside.

Because the controller accepts a `BooksServicer` interface (not a concrete type), you can swap in any implementation that satisfies the interface — including mocks in tests.

Go has no DI framework built in. Manual wiring in `main()` is the standard idiomatic approach for smaller projects. Larger projects may use libraries like Wire or Uber's fx.

---

## Interfaces

### Question
When jumping to definition from a service call in the controller, it goes to the interface rather than the concrete implementation. Why?

### Answer
The controller's `svc` field is typed as `BooksServicer` (the interface), not `BooksService` (the concrete type). From the controller's perspective, it only knows about the interface.

Use "Jump to Implementation" (not "Jump to Definition") to navigate to the concrete type.

Go interfaces are satisfied **implicitly** — if your type has all the right methods, it automatically satisfies the interface. There is no `implements` keyword.

---

## Pointers and the & Operator

### Question
What does `&` do in `return &BooksService{store: store}`?

### Answer
`&` means "give me a pointer to this thing" rather than the thing itself.

- Without `&`: returns a copy of the struct. Methods operate on that copy.
- With `&`: returns a pointer to the struct in memory. Everyone holding a reference points at the same object.

`*TypeName` in a type declaration means "pointer to TypeName". Methods with pointer receivers (`func (s *BooksService)`) only satisfy interfaces when called on a pointer type.

---

## How Methods Attach to Structs

### Question
Where do the methods of `BooksService` get attached to the struct? The struct definition only has a `store` field.

### Answer
Methods aren't stored inside the struct — they're defined separately and attached to the type by the receiver declaration. Go links them at compile time.

```go
type BooksService struct {
    store *data.Store  // only data here
}

// Attached by the receiver (s *BooksService)
func (s *BooksService) List(...) { ... }
```

`NewBooksService` just returns the struct — it doesn't need to register methods. They're already associated with the type.

---

## Custom Types and Method Attachment

### Question
Can you attach methods to built-in types like `int`?

### Answer
No — you can only define methods on types declared in your own package. To attach methods to an `int`, wrap it in a custom type:

```go
type MyInt int

func (i MyInt) Double() int {
    return int(i) * 2
}
```

---

## Operator Overloading

### Question
Does Go support operator overloading?

### Answer
No — a deliberate design decision to keep the language simple and readable. You always know what `+` means.

Custom types give similar expressiveness: instead of overloading `*`, you write a `Double()` method. More verbose, but more explicit.

---

## context.Context

### Question
What is `context.Context`, as seen in `r.Context()` being passed to service calls?

### Answer
`context.Context` is a standard way to carry two things across function calls:

1. **Cancellation signals** — if an HTTP request is cancelled (e.g. user closes the tab), the context cancels too. DB queries and other operations can check for this and abort early.
2. **Request-scoped values** — arbitrary key/value data attached to a request lifetime.

Convention: pass context as the **first argument** of any function that does I/O. Similar to `CancellationToken` in .NET.

---

## Middleware and Context Values (ClaimsFromContext)

### Question
What is `ClaimsFromContext` doing? How do the JWT claims end up in the context?

### Answer
Two-step flow:

**1. `RequireAuth` middleware** runs before the controller:
- Reads the `Authorization: Bearer <token>` header
- Validates the JWT and extracts claims
- Stores claims in context via `context.WithValue`
- Passes the enriched request to the next handler

**2. `ClaimsFromContext`** in the controller:
- Reads the claims back out of context using the same key
- Uses a type assertion (`. (*auth.Claims)`) to cast the untyped context value to the correct type
- Returns the claims and a boolean `ok` indicating whether they were found

The controller never touches the JWT directly — it just reads the pre-validated claims from context.

---

## Export Options

Options for exporting this file to Anki flashcards:

**Option 1 — CSV import (simplest)**
Anki can import a plain CSV where each row is `front, back`. A small script could parse LEARN.md and output that. The `### Question` / `### Answer` structure maps cleanly to front/back.

**Option 2 — AnkiConnect**
AnkiConnect is a popular Anki plugin that exposes a local HTTP API. A script could parse the markdown and POST cards directly into a running Anki instance — no manual import step.

**Option 3 — existing tools**
Tools like `md2anki` or `anki-md` already do markdown-to-Anki conversion, though they typically expect a specific markdown format (e.g. `Q:` / `A:` prefixes or `---` separators) which may not match this file's structure exactly.
