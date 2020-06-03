# query-ts
A jQuery like library based on XStream and FP-TS 2.x.

`npm install query-ts`

Sample usage:

```typescript
// Get a single element from the dom and map over the Option
const c: Option<Q<QElement>> = Q.one(".container");

pipe(
  c,
  filter(e => e.hasClass("container")),
  map(e => e.removeClass("container")),
  getOrElse(() => Q.of(document.createElement("div")))
);


// Get a list of elements from the dom and iterate over the list
const l: Q<QElement>[] = Q.all(".container");

l.map(e => console.log(e.hasClass("container")));
```