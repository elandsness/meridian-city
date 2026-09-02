package com.meridian.transaction.repository;

import com.meridian.transaction.domain.Bill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BillRepository extends JpaRepository<Bill, String> {

    List<Bill> findByIdentityIdOrderByIssuedAtDesc(String identityId);

    List<Bill> findByIdentityIdAndStatusOrderByIssuedAtDesc(String identityId, String status);

    long countByIdentityId(String identityId);

    boolean existsByIdentityIdAndPeriod(String identityId, String period);

    List<String> findDistinctIdentityIds();
}
