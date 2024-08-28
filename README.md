# Custom Table Visualization

## Installation:

### Prerequisites:

- [Node](https://nodejs.org/en/) and [Yarn](https://yarnpkg.com/)
- Reccomended: [IDE/VSCode]()

### Clone this repo and install with:

- ```yarn install```

## Serve the viz for development

- ```yarn start```

[Open The Visualization being served and Trust the Certificate:](https://127.0.0.1:3443/gauge.js)
(Your IP may be different, check the output of the yarn start command and modify the above url.)

In Looker, go to Admin/Visualizations. Add a new visualization pointing to the above file. Give any ID and label.
Then you can select the visualization inside an explore. When you make changes to the visualization files, refresh Looker or toggle visualizations to display the changes. 

## Deploy the visualization:

- ```yarn build```

### From Looker, add a `visualization` parameter to your project's `manifest.lkml` file:

```
visualization: {
  id: "table_vis"
  label: "Custom Table"
  file: "custom_table.js"
}
```

Copy the file generated during the build, `dist/custom_table.js`, to the Looker project.


Looker custom visualization ref:
- https://github.com/looker/custom_visualizations_v2/blob/master/docs/getting_started.md
- https://github.com/looker/custom_visualizations_v2
- https://cloud.google.com/looker/docs/reference/param-manifest-visualization
