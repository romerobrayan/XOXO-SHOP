// Sort options shared by the server page (validates the URL param, sorts) and
// the client SortSelect. Lives outside the "use client" module so the server
// gets the real array, not a client reference.
export const SORT_OPTIONS = [
  { value: "relevancia", label: "Relevancia" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];
