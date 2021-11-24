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
  //  These are the Looker Viz Config menu options.
  options: {
    upperThreshold: {
      type: "number",
      label: "Upper Threshold (colored section)",
      display: "number"
    },
    lowerThreshold: {
      type: "number",
      label: "Lower Threshold (colored section)",
      display: "number"
    }
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
    // console.dir(`lower threshold: ${filterMin}`);
    // console.dir(`lower threshold: ${filterMax}`);

    // applied_filters["analytics_func_simple.channel_id"].value
    const hasAppliedFilters = !!queryResponse && !!queryResponse.applied_filters
    let dashboardLowerFilter = hasAppliedFilters && queryResponse.applied_filters["analytics_func_simple.gauge_lower_threshold"]?.value
    let dashboardUpperFilter = hasAppliedFilters && queryResponse.applied_filters["analytics_func_simple.gauge_upper_threshold"]?.value

    const filterMin = dashboardLowerFilter ? dashboardLowerFilter : config.lowerThreshold
    const filterMax = dashboardUpperFilter ? dashboardUpperFilter : config.upperThreshold

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

    // This function finds the lowest value in the data.
    let derivedMin = Math.min(
      ...data.map((x) => {
        // 1.0 turns it into a number, just in case it isn't!
        return 1.0 * x[measures[0].name].value;
      })
    );
    // Display the greatest range possible, so whichever is lower, use it.
    let minValue = 0
    if (derivedMin != undefined) minValue = derivedMin; 
    if (filterMin != undefined && filterMin < derivedMin) minValue = filterMin;
    
    // This function finds the highest value in the data.
    let derivedMax = Math.max(
      ...data.map((x) => {
        // 1.0 turns it into a number, just in case it isn't!
        return 1.0 * x[measures[0].name].value;
      })
    );
    // Display the greatest range possible, so whichever is higher, use it.
    let maxValue = filterMax > derivedMax ? filterMax : derivedMax || 0
 
    // Always show some range:
    if (minValue === maxValue) {
      minValue = minValue * 0.9 - 1
      maxValue = maxValue * 1.1 + 1
    }

    // Find the latest entry (by index) and pull out the title/header values, time and pointer value.
    const [minTime, maxTime, maxIndex] = getMinMaxDatetimes(data, timeSeries);
    const latest = data[maxIndex][measures[0].name].value;
    const title = data[maxIndex][measures[0].name].html;
    const subtitle = data[maxIndex][timeSeries[0].name].value;
    const options = gaugeOptions(minValue, maxValue, latest, fontFamily, title, subtitle);
    
    
    // TODO rewrite this to use 'undefined' instead of 0
    if (filterMin == 0 || filterMin !== 0) {
      // Ignore the @ts-ignore comments. They just tell typescript to chill.
    // @ts-ignore
      options.yAxis.plotBands = [
        // Set the colored bands
        {
          from: minValue,
          to: maxValue,
          color: "#D2DEE3",
          thickness: "30%",
        },
        {
          from: filterMin,
          to: filterMax,
          color: "#83BC40",
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
