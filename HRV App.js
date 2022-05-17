/**
 * App visualize HRV with Standart Deviation and Root Mean Squared
 * @author : SDP_GROUP
 * @param {int} BUTTON_OPTION - Start option to calculate HRV
 * @param {File} LOG_FILE  - Storing the data of results
 * @param {Array} LOG_FILE_HEADER - name of headers of csv file
 * @param {int} samples - Counting LOG FILE of sample count
 * @param {boolean} collectData  - Checking collecting date is active or not
 * @param {Float32Array} raw_HR_array 
 * @param {Float32Array} alternate_array  
 */


var BUTTON_OPTION = null;


/**
 * Creating LOG_FILE in storage then using for calculating heart rate
 */
var LOG_FILE = require("Storage").open("HRV_log.xlsx", "w");
LOG_FILE = require("Storage").open("HRV_log.xlsx", "a");


var LOG_FILE_HEADER = [
  "No",
  "Sample count",
  "HR",
  "SDNN",
  "RMSSD",
  "Temp",
  "movement",
];
LOG_FILE.write(LOG_FILE_HEADER.join(",") + "\n");

var errorPercentage = 25;
var samples = 0; 
var collectingData = false; 

var raw_heart_rate_array = new Float32Array(1536);
var alternate_array = new Float32Array(3072);
var heartPulseArray = [];
var CUTOFF_THRESHOLD = 0.5;
var SAMPLE_FREQUENCY = 51.6;
var Blank_THRESHOLD = 0.15;
var MOVEMENT = 0;

var CORRDINATE_X = g.getWidth() / 2;
var CORRDINATE_Y = g.getHeight() / 2;
var acceleration;

/**
 * This function stores hrv data.
 * @param {string} file_type is optional
 * @param {array} data  array of raw heart rate
 */

function storeHrvData(data, file_type) {
  "ram";
  log = raw_heart_rate_array;
  
  log.set(new Float32Array(log.buffer, 4));
  
  log[log.length - 1] = data;
}


/**
 * This function return average number of samples.
 * @param {long} samples 
 * @returns {long} finding the sum of samples 
 * then divide to the length of samples
 */
function FindingAverage(samples) {
  return element.sum(samples) / samples.length;
}


/**
 * This function for finding Standart Deviation.
 * @param {array} sd_array 
 * @returns {array} collecting sum of 
 * standart deviation array data 
 * then first finding average of the squared differences
 *  from the mean and square root of result of the variance
 */

function StandardDeviation(sd_array) {
  const average = element.sum(sd_array) / sd_array.length;  
  return Math.sqrt(element.variance(sd_array, average)); 
}

/**
 * Set the power to the Heart rate monitor.
 * It shows the five stage of hrv status 
 * First Collecting 1/5  collecting 
 * the raw_heart_rate_array using rolling average function
 * Second Arranging 2/5 upscaling the array
 * Third Measuring 3/5 rolling average the alternate array 
 * Applying 4/5 applying cutoff and finding peak points
 * Calculating 5/5 finishing all procedures and display the result
 * 
 */
function Preprocessing() {
  Bangle.setHRMPower(0);

  g.clear();
  g.drawString("Collecting 1/5", CORRDINATE_X, CORRDINATE_Y);

  rolling_average(raw_heart_rate_array, 5);
  g.clear();
  g.drawString("Arranging 2/5", CORRDINATE_X, CORRDINATE_Y);

  upscale();
  g.clear();
  g.drawString("Measuring  3/5", CORRDINATE_X, CORRDINATE_Y);

  rolling_average(alternate_array, 5);
  g.clear();
  g.drawString("Applying 4/5", CORRDINATE_X, CORRDINATE_Y);

  apply_cutoff();
  find_peak_points();
  g.clear();
  g.drawString("Calculating 5/5", CORRDINATE_X, CORRDINATE_Y);

  calculate_HRV();
}

/**
 * Function for Bernstein polynomial.
 * @param {int} A 
 * @param {int} B
 * @param {int} C
 * @param {int} D
 * @param {int} E
 * @param {int} t
 * @returns {int} 
 */
function BernsteinPolynomial(A, B, C, D, E, t) {
  "ram";
  s = 1 - t;
  x =
    A * Math.pow(s, 4) +
    B * 4 * Math.pow(s, 3) * t +
    C * 6 * s * s * t * t +
    D * 4 * s * Math.pow(t, 3) +
    E * Math.pow(t, 4);
  return x;
}



function upscale() {
  "ram";
  var index = 0;
  for (let i = raw_heart_rate_array.length - 1; i > 5; i -= 5) {
    polynomial0 = raw_heart_rate_array[i];
    polynomial1 = raw_heart_rate_array[i - 1];
    polynomial2 = raw_heart_rate_array[i - 2];
    polynomial3 = raw_heart_rate_array[i - 3];
    polynomial4 = raw_heart_rate_array[i - 4];
    for (let K = 0; K < 100; K += 10) {
      x = K / 100;
      result = BernsteinPolynomial(polynomial0, polynomial1,
               polynomial2, polynomial3, polynomial4, x);
      alternate_array[index] = result;
      index++;
    }
  }
}

/**
 * Function for Rolling Average.
 * @param {int} values 
 * @param {int} count 
 * @returns {array} function returns average of an array, first we find sum of all elemets in an array using for loop
 * then divide sum with the number of elements present in array. 
 */

function rolling_average(values, count) {
  "ram";
  var temporary_array = [];

  for (let i = 0; i < values.length; i++) {
    temporary_array = [];
    for (let x = 0; x < count; x++){ 
    temporary_array.push(values[i + x]);
    values[i] = FindingAverage(temporary_array);
    }
  }
}

/**
 * Function for Apply Cutoff.
 * @returns {array} we use for loop to loop through alternate array elemets then alternate array's i index element equal to the result
 *  when if condition is true
 */

function apply_cutoff() {
  "ram";
  var result;
  for (let i = 0; i < alternate_array.length; i++) {
    result = alternate_array[i];
    if (result < CUTOFF_THRESHOLD) result = CUTOFF_THRESHOLD;
    alternate_array[i] = result;
  }
}

/**
 * Function for Finding Peak Points.
 * @returns {array} 
 */

function find_peak_points() {
  "ram";
  var previous;
  var preceding_slope = 0;
  var slope;
  var blank_size = 0;
  var temp_array = [];

  for (let i = 0; i < alternate_array.length; i++) {
    if (previous == null) previous = alternate_array[i];
    slope = alternate_array[i] - previous;
    if (slope * preceding_slope < 0) {
      if (blank_size > 30) {
        heartPulseArray.push(blank_size);
        blank_size = 0;
      }
    } else {
      blank_size++;
    }
    preceding_slope = slope;
    previous = alternate_array[i];
  }
}

/**
 * Function for Root Mean Square of Successive Differences.
 * @param {array} samples
 * @returns {int}  we calculate each successive time differnece between heartbeats in ms.
 * Then each of the values is squared and the result is averaged before the square root of the total is obtained
 */

function RMSSD(samples) {
  "ram";
  var sum = 0;
  var square = 0;
  var data = [];
  var value = 0;

  for (let i = 0; i < samples.length - 1; i++) {
    value =
      Math.abs(samples[i] - samples[i + 1]) *
      ((1 / (SAMPLE_FREQUENCY * 2)) * 1000);
    data.push(value);
  }

  for (let i = 0; i < data.length; i++) {
    square = data[i] * data[i];
    Math.round(square);
    sum += square;
  }

  var meansquare = sum / data.length;
  var root_mean_square = Math.sqrt(meansquare);
  root_mean_square = parseInt(root_mean_square);
  return root_mean_square;
}


/**
 * Function for Calculating Heart Rate Variability.
 * @returns {array} in this function we calculate HR and subtract the error percentage which we applied error percentage formula to our HRV results.
 * when the top right button of the bangle.js clicked function starts to use previous functions to finding SDDN, RMSSD, HR, and Sample Count.
 * Then result of these are stored in our result_file array.
 */

function calculate_HRV() {
  var gap_average = FindingAverage(heartPulseArray);
  var temporary_array = [];
  var gap_max = (1 + Blank_THRESHOLD) * gap_average;
  var gap_min = (1 - Blank_THRESHOLD) * gap_average;
  for (let i = 0; i < heartPulseArray.length; i++) {
    if (heartPulseArray[i] > gap_min && heartPulseArray[i] < gap_max)
      temporary_array.push(heartPulseArray[i]);
  }
  gap_average = FindingAverage(temporary_array);
  var calculatedHR = (SAMPLE_FREQUENCY * 60) / (gap_average / 2);
  var HRResult = calculatedHR- (errorPercentage*calculatedHR)/100;
  if (BUTTON_OPTION == 0) Bangle.setLCDPower(1);
  g.clear();
  var SDNN = (
    StandardDeviation(temporary_array) *
    ((1 / (SAMPLE_FREQUENCY * 2)) * 1000)
  ).toFixed(0);
  var resultArray = RMSSD(temporary_array);
  g.drawString(
    "SDNN:" +
      SDNN +
      "\nRMSSD:" +
      resultArray +
      "\nHR:" +
      HRResult.toFixed(0) +
      "\nSample Count:" +
      temporary_array.length,
    CORRDINATE_X,
    CORRDINATE_Y
  );
  Bangle.setLCDPower(1);
  if (BUTTON_OPTION == 0) {
    // single run
    Bangle.buzz(500, 1);
    BUTTON_OPTION = null;
    drawButtons();
  } else {
    var resultFile = [
      0 | getTime(),
      temporary_array.length,
      HRResult.toFixed(0),
      SDNN,
      resultArray,
      E.getTemperature(),
      MOVEMENT.toFixed(5),
    ];
    LOG_FILE.write(resultFile.join(",") + "\n");

    turn_on();
  }
}

function btn1Pressed() {
  if (BUTTON_OPTION === null) {
    g.clear();
    g.drawString("one-off assessment", CORRDINATE_X, CORRDINATE_Y);
    BUTTON_OPTION = 0;

    turn_on();
  }
}


function turn_on() {
  BPM_array = [];
  heartPulseArray = [];
  samples = 0;
  if (acceleration) clearInterval(acceleration);
  MOVEMENT = 0;
  acceleration = setInterval(function () {
    MOVEMENT = MOVEMENT + Bangle.getAccel().diff;
  }, 1000);
  Bangle.setHRMPower(1);
  collectingData = true;
}

function drawButtons() {
  g.setColor("#00ff7f");
  g.setFont("6x8", 2);
  g.setFontAlign(-1, 1);
  g.drawString("Measure", 140, 50);
  g.setColor("#ffffff");
  g.setFontAlign(0, 0);
}

g.clear();

drawButtons();

g.setFont("6x8", 2);
g.setColor("#ffffff");
g.setFontAlign(0, 0); // center font
g.drawString("HRV Project", CORRDINATE_X, CORRDINATE_Y);

setWatch(btn1Pressed, BTN1, { repeat: true });

Bangle.on("HRM-raw", function (e) {
  if (!collectingData) return;
  storeHrvData(e.raw, 0);
  if (!(samples & 7)) {
    Bangle.setLCDPower(1);
    g.clearRect(0, CORRDINATE_Y - 10, g.getWidth(), CORRDINATE_Y + 22);
    if (samples < 100)
      g.drawString(
        "setting up...\nremain still " + samples + "%",
        CORRDINATE_X,
        CORRDINATE_Y,
        true
      );
    else
      g.drawString(
        "Please wait: " + ((samples * 100) / raw_heart_rate_array.length).toFixed(0) + "%",
        CORRDINATE_X,
        CORRDINATE_Y,
        true
      );
  }
  if (samples > raw_heart_rate_array.length) {
    collectingData = false;
    Preprocessing();
  }
  samples++;
});