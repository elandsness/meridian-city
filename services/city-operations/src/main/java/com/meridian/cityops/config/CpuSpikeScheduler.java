package com.meridian.cityops.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Background scheduler that executes a tight computation loop when the
 * cpu-spike fault flag is enabled.  Checked every 5 seconds.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CpuSpikeScheduler {

    private final FaultInjectionConfig faultConfig;

    @Scheduled(fixedDelay = 5000)
    public void checkAndSpike() {
        if (!faultConfig.getCpuSpike().isEnabled()) {
            return;
        }
        log.warn("CPU spike fault injection active — running computation loop");
        // Burn ~500 ms of CPU in a tight loop
        long end = System.currentTimeMillis() + 500;
        long result = 0;
        while (System.currentTimeMillis() < end) {
            // deliberately tight — purely CPU bound
            for (int i = 0; i < 100_000; i++) {
                result += (long) Math.sqrt(i);
            }
        }
        // Use the result so the JIT cannot elide the loop
        log.debug("CPU spike iteration result: {}", result);
    }
}
