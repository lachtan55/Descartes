/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3332084752")

  // starred: bool — user-curated flag for Macroeconomics Highlighted Docs panel
  collection.fields.add(new Field({
    "id":          "bool4247461001",
    "name":        "starred",
    "type":        "bool",
    "required":    false,
    "system":      false,
    "hidden":      false,
    "presentable": false,
  }))

  // starred_at: date — timestamp of when the document was starred
  collection.fields.add(new Field({
    "id":          "date7438521112",
    "name":        "starred_at",
    "type":        "date",
    "required":    false,
    "system":      false,
    "hidden":      false,
    "presentable": false,
    "options": {
      "min": "",
      "max": ""
    }
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3332084752")
  collection.fields.removeById("bool4247461001")
  collection.fields.removeById("date7438521112")
  return app.save(collection)
})
