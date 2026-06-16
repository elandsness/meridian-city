package com.meridian.billing.repository;

import com.meridian.billing.domain.TaxBill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaxBillRepository extends JpaRepository<TaxBill, String> {

    List<TaxBill> findByCitizenIdOrderByIssuedAtDesc(String citizenId);

    List<TaxBill> findByCitizenIdAndStatusOrderByIssuedAtDesc(String citizenId, String status);

    long countByCitizenId(String citizenId);
}
