"use strict";
import hi from "highland";

/**
 * Create a reporter that monitors the throughput of a highland stream.
 *
 * @param {String} name name that identifies this reporter
 * @returns {(x: Highland.Stream) => Highland.Stream} a function to be passed to Stream.through()
 */
function createStreamThroughputReporter(name) {
  let total = 0;
  let rate = 0;
  let ema = 0;
  let ticks = 0;
  const alpha = 0.5;
  const statsReporter = () => {
    ticks++;
    ema = alpha * rate + ema * (1 - alpha);
    console.log(
      `STATS[${name}]: rate=${rate}, total=${total}, ema=${ema.toFixed(2)}, avg=${(total / ticks).toFixed(2)}`,
    );
    rate = 0;
  };

  const statsReporterInterval = setInterval(statsReporter, 1000);
  return (stream) =>
    stream.consume(function (err, val, push, next) {
      if (err) {
        clearInterval(statsReporterInterval);
        push(err);
        next();
      } else if (val === hi.nil) {
        statsReporter();
        clearInterval(statsReporterInterval);
        push(null, val);
      } else {
        rate++;
        total++;
        push(null, val);
        next();
      }
    });
}

/**
 * A token bucket rate limiter for highland.
 *
 * @param {Number} rate records per second
 * @returns {(x: Highland.Stream) => Highland.Stream} a function to be passed to Stream.through()
 */
function createContinuousRateLimiter(rate) {
  let capacity = 0;
  let previousUpdate = Date.now();

  const capacityUpdateWaitMs = 32;
  const capacityUpdater = setInterval(() => {
    capacity += (rate / 1000) * (Date.now() - previousUpdate);
    capacity = Math.min(capacity, rate * 1.2);
    previousUpdate = Date.now();
  }, capacityUpdateWaitMs);

  const oneCapacityUnitWaitMs = Math.max(1000 / rate, 2);
  return (stream) =>
    stream.consume(function (err, val, push, next) {
      if (err) {
        clearInterval(capacityUpdater);
        push(err);
        next();
      } else if (val === hi.nil) {
        clearInterval(capacityUpdater);
        push(null, val);
      } else {
        if (capacity-- > 0) {
          push(null, val);
          next();
        } else {
          setTimeout(
            () => {
              push(null, val);
              next();
            },
            Math.max(capacityUpdateWaitMs, oneCapacityUnitWaitMs * 2),
          );
        }
      }
    });
}

export default {
  createStreamThroughputReporter,
  createContinuousRateLimiter,
};
