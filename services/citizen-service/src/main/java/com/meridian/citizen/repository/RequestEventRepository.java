package com.meridian.citizen.repository;

import com.meridian.citizen.domain.RequestEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RequestEventRepository extends JpaRepository<RequestEvent, Long> {
}
