# query-ts
A jQuery like library based on XStream and FP-TS 2.x.

```
npm install query-ts
```

Sample usage:

```typescript
// Get a single element from the dom and map over the Option
import {Q, QElement, UnsafeHtml} from "query-ts";
import {pipe} from "fp-ts/lib/pipeable"
import {Option, filter, map, getOrElse} from "fp-ts/lib/Option";

const c: Option<Q<QElement>> = Q.one(".container");

const el: Q<QElement> = pipe(
  c,
  filter(e => e.hasClass("container")), // Filter and map over the Option<Q>
  map(e => e.removeClass("container")),
  getOrElse(() => Q.of(document.createElement("div"))) // Lift an element into Q in case of None
);

const html: UnsafeHtml = el.getOuterHtml();

console.log(html.toString())


// Get a list of elements from the dom and iterate over the list
const l: Q<QElement>[] = Q.all(".container");

l.map(e => console.log(e.hasClass("container")));
```
