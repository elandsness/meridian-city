package com.meridian.citizen.repository;

import com.meridian.citizen.domain.AccountEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AccountEventRepository extends JpaRepository<AccountEvent, Long> {
}
