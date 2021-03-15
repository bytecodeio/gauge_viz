import { Looker, VisualizationDefinition } from "../common/types";
import {
  handleErrors,
  getMinMaxDatetimes,
  processQueryResponse,
  gaugeOptions,
} from "../common/utils";
import { fontFamily } from "../common/chart-defaults";
import { Chart, Options } from "highcharts";
import { Highcharts } from "highcharts-more-node";

declare var looker: Looker;

interface GaugeViz extends VisualizationDefinition {
  elementRef?: HTMLDivElement;
}

const vis: GaugeViz = {
  id: "gauge-chart", // id/label not required, but nice for testing and keeping manifests in sync
  label: "gauge-chart",
  options: {
    color: {
      type: "array",
      label: "Colors",
      display: "colors",
      default: [
        "#75E2E2",
        "#3EB0D5",
        "#4276BE",
        "#592EC2",
        "#9174F0",
        "#B1399E",
        "#B32F37",
        "#E57947",
        "#FBB555",
        "#FFD95F",
        "#C2DD67",
        "#72D16D",
      ].map((value) => {
        return value.toLowerCase();
      }),
    },
    title: {
      type: "string",
      label: "Chart(s) with Navigator",
      display: "text",
      default: "Chart(s) with Navigator",
    },
    charts: {
      type: "string",
      label: "Type of Chart(s)",
      display: "select",
      values: [{ "Gauge Chart": "gauge" }],
      default: "gauge",
    },
    overlay: {
      type: "boolean",
      label: "Overlay",
      display: "checkbox",
      default: true,
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
    const filterMin =
      queryResponse &&
      queryResponse.applied_filters &&
      queryResponse.applied_filters["analytics_func.gauge_lower_threshold"] &&
      queryResponse.applied_filters["analytics_func.gauge_lower_threshold"]
        .value;
    const filterMax =
      queryResponse &&
      queryResponse.applied_filters &&
      queryResponse.applied_filters["analytics_func.gauge_upper_threshold"] &&
      queryResponse.applied_filters["analytics_func.gauge_upper_threshold"]
        .value;
    console.dir(`lower threshold: ${filterMin}`);
    console.dir(`lower threshold: ${filterMax}`);

    const errors = handleErrors(this, queryResponse, {
      min_pivots: 0,
      max_pivots: 0,
      min_dimensions: 1,
      max_dimensions: 5,
      min_measures: 1,
      max_measures: 1,
    });


    let [pivots, dimensions, measures] = processQueryResponse(queryResponse);
    let fields = dimensions.concat(measures);
    let timeSeries = fields.filter((field) => field.type?.includes("date"));

    if (timeSeries.length > 1) {
      console.log(
        "More than one date dimension or measure was found. Only one date dimension or measure is supported for time series data."
      );
    }

          
    let derivedMin = Math.min(
      ...data.map((x) => {
        return 1.0 * x[measures[0].name].value;
      })
    );
    let minValue = filterMin < derivedMin ? filterMin : derivedMin || 0
    // if (filterMin) {
    //   minValue = filterMin
    // } else if (derivedMin) {
    //   minValue = derivedMin
    // } else if (filterMin === 0) {
    //   minValue = 0
    // }
    
    let derivedMax = Math.max(
      ...data.map((x) => {
        return 1.0 * x[measures[0].name].value;
      })
    );
    let maxValue = filterMax > derivedMax ? filterMax : derivedMax || 0
    // if (filterMax) {
    //   maxValue = filterMax
    // } else if (derivedMax) {
    //   maxValue = derivedMax
    // } else if (filterMax === 0) {
    //   maxValue = 0
    // }
    
    // Always show some range:
    if (minValue === maxValue) {
      minValue = minValue * 0.9
      maxValue = maxValue * 1.1
    }

    const [minTime, maxTime, maxIndex] = getMinMaxDatetimes(data, timeSeries);


    const latest = data[maxIndex][measures[0].name].value;
    const title = data[maxIndex][measures[0].name].rendered;
    const subtitle = data[maxIndex][timeSeries[0].name].value;
    const options = gaugeOptions(minValue, maxValue, latest, fontFamily, title, subtitle);
    
    // Set the colored bands
    if (filterMin == 0 || filterMin !== 0) {
    // @ts-ignore
      options.yAxis.plotBands = [
        {
          from: minValue,
          to: filterMin,
          color: "#D2DEE3",
          thickness: "30%",
        },
        {
          from: filterMin,
          to: filterMax,
          color: "#83BC40",
          thickness: "30%",
        },
        {
          from: filterMax,
          to: maxValue,
          color: "#D2DEE3",
          thickness: "30%",
        },
      ]
    } else {
      // @ts-ignore
      options.yAxis.plotBands = [
        {
          from: minValue,
          to: maxValue,
          color: "#D2DEE3",
          thickness: "30%",
        }
      ]
    }
    options.tooltip = {
      enabled: false
    }
    // @ts-ignore
    Highcharts.chart(element, options);
  },
};

looker.plugins.visualizations.add(vis);
