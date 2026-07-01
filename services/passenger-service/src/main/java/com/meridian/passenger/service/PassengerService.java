package com.meridian.passenger.service;

import com.meridian.passenger.config.PassengerJourneyProperties;
import com.meridian.passenger.domain.Passenger;
import com.meridian.passenger.repository.PassengerRepository;
import com.meridian.passenger.util.BusinessEventLogger;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PassengerService {

    private final PassengerRepository repository;
    private final PassengerJourneyProperties journeyProps;
    private final BusinessEventLogger businessEvents;

    /** Persist a new passenger, schedule its first journey transition, emit the opening event. */
    @Transactional
    public Passenger create(Passenger passenger) {
        passenger.setNextTransitionAt(OffsetDateTime.now().plusSeconds(journeyProps.nextDelaySeconds()));
        Passenger saved = repository.save(passenger);
        businessEvents.passengerStatus(saved);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Passenger> board() {
        return repository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public Passenger findById(String id) {
        return repository.findById(id).orElse(null);
    }

    @Transactional(readOnly = true)
    public List<Passenger> byStatus(String status) {
        return repository.findByStatus(status);
    }
}
