package com.meridian.dispatch.repository;

import com.meridian.dispatch.domain.RequestEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RequestEventRepository extends JpaRepository<RequestEvent, Long> {
}
