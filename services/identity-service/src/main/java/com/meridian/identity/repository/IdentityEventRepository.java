package com.meridian.identity.repository;

import com.meridian.identity.domain.IdentityEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IdentityEventRepository extends JpaRepository<IdentityEvent, Long> {
}
