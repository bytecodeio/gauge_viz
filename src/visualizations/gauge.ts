import { Looker, VisualizationDefinition } from "../common/types";
import {
  handleErrors,
  getMinMaxDatetimes,
  processQueryResponse,
  gaugeOptions,
  flexibleGaugeOptions,
} from "../common/utils";
import { fontFamily } from "../common/chart-defaults";
import { Chart, Options } from "highcharts";
import { Highcharts } from "highcharts-more-node";

declare var looker: Looker;

declare var LookerCharts: {
  Utils: {
    htmlForCell: (cell: any) => string;
  };
};
interface GaugeViz extends VisualizationDefinition {
  elementRef?: HTMLDivElement;
}

interface Measure {
  label: string;
  name: string;
}

const vis: GaugeViz = {
  id: "gauge-chart", // id/label not required, but nice for testing and keeping manifests in sync
  label: "gauge-chart",
  //  These are the Looker Viz Config menu options.
  options: {
    metricColor: {
      type: "array",
      label: "Metric Color",
      display: "color",
      section: "Style",
    },
    redColor: {
      type: "array",
      label: "Red Color",
      display: "color",
      section: "Style",
    },
    greenColor: {
      type: "array",
      label: "Green Color",
      display: "color",
      section: "Style",
    },
    yellowColor: {
      type: "array",
      label: "Yellow Color",
      display: "color",
      section: "Style",
    },
    backgroundColor: {
      type: "array",
      label: "Background Color",
      display: "color",
      section: "Style",
    },
    backgroundDialColor: {
      type: "array",
      label: "Background Dial Color",
      display: "color",
      section: "Style",
    },
    markerColor: {
      type: "array",
      label: "Marker Color",
      display: "color",
      section: "Style",
    },

  },
  // Set up the initial state of the visualization
  create(element, config) {
    element.className = "highcharts-custom-vis";

  },
  // Render in response to the data or settings changing
  update(data, element, config, queryResponse) {
    // console.log("data", data);
    // console.log("element", element);
    // console.log("config", config);
    console.log("queryResponse", queryResponse);
    const hasAppliedFilters = !!queryResponse && !!queryResponse.applied_filters
    let dashboardLowerFilter = hasAppliedFilters && queryResponse.applied_filters["analytics_func_simple.gauge_lower_threshold"]?.value
    let dashboardUpperFilter = hasAppliedFilters && queryResponse.applied_filters["analytics_func_simple.gauge_upper_threshold"]?.value

    const filterMin = dashboardLowerFilter ? dashboardLowerFilter : config.lowerThreshold
    const filterMax = dashboardUpperFilter ? dashboardUpperFilter : config.upperThreshold

    const errors = handleErrors(this, queryResponse, {
      min_pivots: 0,
      max_pivots: 0,
      min_dimensions: 0,
      max_dimensions: 0,
      min_measures: 3,
      max_measures: 10,
    });

    const { measure_like: measureLike } = queryResponse.fields;
    const measures1: Measure[] = measureLike.map((measure) => ({
      label: measure.label_short ?? measure.label,
      name: measure.name,
    }));

    const updatedOptions = { ...this.options };
    updatedOptions["currentValue"] = {
      section: "Metrics",
      type: "string",
      label: "Current Value",
      display: "select",
      order: 1,
      values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
      default: measures1[0].name,
    };
    updatedOptions["minValue"] = {
      section: "Metrics",
      type: "string",
      label: "Minimum Value",
      display: "select",
      order: 2,
      values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
      default: measures1[0].name,
    };
    updatedOptions["endRedBeginYellow"] = {
      section: "Metrics",
      type: "string",
      label: "End Red Begin Yellow",
      display: "select",
      order: 3,
      values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
      default: measures1[0].name,
    };
    updatedOptions["endYellowBeginGreen"] = {
      section: "Metrics",
      type: "string",
      label: "End Yellow Begin Green",
      display: "select",
      order: 4,
      values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
      default: measures1[0].name,
    };
    updatedOptions["targetValue"] = {
      section: "Metrics",
      type: "string",
      label: "Target Value",
      display: "select",
      order: 5,
      values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
      default: measures1[0].name,
    };
    updatedOptions["endGreenBeginYellow"] = {
      section: "Metrics",
      type: "string",
      label: "End Green Begin Yellow",
      display: "select",
      order: 6,
      values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
      default: measures1[0].name,
    };
    updatedOptions["endYellowBeginRed"] = {
      section: "Metrics",
      type: "string",
      label: "End Yellow Begin Red",
      display: "select",
      order: 7,
      values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
      default: measures1[0].name,
    };
    updatedOptions["maxValue"] = {
      section: "Metrics",
      type: "string",
      label: "Maximum Value",
      display: "select",
      order: 8,
      values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
      default: measures1[0].name,
    };

    this.trigger("registerOptions", updatedOptions);

    let [pivots, dimensions, measures] = processQueryResponse(queryResponse);
    let fields = dimensions.concat(measures);
    let timeSeries = fields.filter((field) => field.type?.includes("date"));

    if (timeSeries.length > 1) {
      console.log(
        "More than one date dimension or measure was found. Only one date dimension or measure is supported for time series data."
      );
    }

    const cellValue = (configName: string) => Number(data[0][config[configName]]?.value);
    const cellHTML = (configName: string) => LookerCharts.Utils.htmlForCell(data[0][config[configName]]);
    const innerRadius = (minField: string, maxField: string): string => {
      if (cellValue('currentValue') >= cellValue(minField) && cellValue('currentValue') <= cellValue(maxField)) {
        return '40%';
      } else {
        return '90%';
      }
    };

    // Display the greatest range possible, so whichever is lower, use it.
    const minValue = cellValue('minValue') || 0;

    const maxValue = cellValue('maxValue') || 100;

    console.log("minValue", minValue);
    // Find the latest entry (by index) and pull out the title/header values, time and pointer value.
    const latest = data[0][measures[0].name].value;
    const title = data[0][measures[0].name].html;
    const subtitle = data[0][timeSeries[0]?.name]?.value;
    // const options = gaugeOptions(minValue, maxValue, latest, fontFamily, title, subtitle);
    const options: Highcharts.options = flexibleGaugeOptions()

    options.yAxis.min = Number(minValue);
    options.yAxis.max = Number(maxValue);
    options.series[0].data = [cellValue('currentValue')];
    options.subtitle.text = `${cellHTML('currentValue')} of ${cellHTML('targetValue')}`;
    options.title.text = Math.round(cellValue('currentValue') / cellValue('targetValue') * 100) + "%";
    options.series[0].dial.backgroundColor = config.markerColor[0];
    options.chart.backgroundColor = config.backgroundColor[0];

    options.yAxis.plotBands = [
      // Set the colored bands
      {
        from: cellValue('minValue'),
        to: cellValue('maxValue'),
        color: config.backgroundDialColor[0], 
        innerRadius: '40%', // Inner radius for background grey
        outerRadius: '100%'
      },
      {
        from: cellValue('minValue'),
        to: cellValue('endRedBeginYellow'),
        color: config.redColor[0], 
        innerRadius: innerRadius('minValue', 'endRedBeginYellow'), 
        outerRadius: '100%'
      }, {
        from: cellValue('endRedBeginYellow'),
        to: cellValue('endYellowBeginGreen'),
        color: config.yellowColor[0], 
        innerRadius: innerRadius('endRedBeginYellow', 'endYellowBeginGreen'), 
        outerRadius: '100%'
      }, {
        from: cellValue('endYellowBeginGreen'),
        to: cellValue('endGreenBeginYellow'),
        color: config.greenColor[0], 
        innerRadius: innerRadius('endYellowBeginGreen', 'endGreenBeginYellow'), 
        outerRadius: '100%'
      }, {
        from: cellValue('endGreenBeginYellow'),
        to: cellValue('endYellowBeginRed'),
        color: config.yellowColor[0], 
        innerRadius: innerRadius('endGreenBeginYellow', 'endYellowBeginRed'), 
        outerRadius: '100%'
      }, {
        from: cellValue('endYellowBeginRed'),
        to: cellValue('maxValue'),
        color: config.redColor[0], 
        innerRadius: innerRadius('endYellowBeginRed', 'maxValue'), 
        outerRadius: '100%'
      },
      {
        from: cellValue('minValue'),
        to: cellValue('maxValue'),
        color: config.metricColor[0], // static style
        innerRadius: '30%', // Inner radius for metric
        outerRadius: '35%'
      }
    ]

    let titleColor = '#000000';
    const plotBands = options.yAxis.plotBands;
    for (let i = 1; i < plotBands.length -1; i++) {
      const band = plotBands[i];
      if (cellValue('currentValue') >= band.from && cellValue('currentValue') <= band.to) {
        titleColor = band.color;
        break;
      }
    }
    options.title.style.color = titleColor;
  
    options.title.style.color = titleColor;
    Highcharts.chart(element, options);
  },
};

looker.plugins.visualizations.add(vis);
